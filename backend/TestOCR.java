import java.util.*;
import java.io.*;
import java.nio.file.*;
import java.net.*;
import java.net.http.*;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.rendering.ImageType;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;

public class TestOCR {
    public static void main(String[] args) throws Exception {
        // Read API key
        String apiKey = System.getenv("AI_PROVIDER_API_KEY");
        if (apiKey == null) {
            System.out.println("API Key not found!");
            return;
        }

        // Dummy PDF
        File pdfFile = new File("dummy.pdf");
        if (!pdfFile.exists()) {
            try (PDDocument doc = new PDDocument()) {
                doc.addPage(new org.apache.pdfbox.pdmodel.PDPage());
                doc.save(pdfFile);
            }
        }

        // Convert PDF page 0 to PNG base64
        String base64Image;
        try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(pdfFile)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            BufferedImage image = renderer.renderImageWithDPI(0, 72, ImageType.RGB);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
        }
        System.out.println("Rendered image size: " + base64Image.length());

        // Call Nemotron OCR v2
        String jsonPayload = """
        {
            "model": "nvidia/nemotron-ocr-v2",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,%s"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 1024
        }
        """.formatted(base64Image);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://integrate.api.nvidia.com/v1/chat/completions"))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println("Status: " + response.statusCode());
        System.out.println("Response: " + response.body().substring(0, Math.min(500, response.body().length())));
    }
}
