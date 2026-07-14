package com.sudheeai.backend.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.*;

@Service
@SuppressWarnings("unchecked")
public class AIService {

    private final WebClient webClient;
    private final String nvidiaApiKey;

    public AIService(
            WebClient.Builder webClientBuilder,
            @Value("${app.ai.gemini-key}") String nvidiaApiKey) {
        this.webClient = webClientBuilder.build();
        this.nvidiaApiKey = nvidiaApiKey;
    }
    
    private String getGeminiApiKey() {
        String key = System.getProperty("GEMINI_API_KEY");
        if (key == null || key.trim().isEmpty()) {
            key = System.getenv("GEMINI_API_KEY");
        }
        if (key == null || key.trim().isEmpty()) {
            key = nvidiaApiKey; // Fallback just in case
        }
        return key;
    }

    public Mono<String> callOCR(byte[] pdfBytes) {
        if (nvidiaApiKey == null || nvidiaApiKey.trim().isEmpty()) {
            return Mono.error(new IllegalStateException("NVIDIA API Key is not configured for OCR"));
        }
        
        return Mono.fromCallable(() -> {
            String base64Image;
            try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(pdfBytes)) {
                PDFRenderer renderer = new PDFRenderer(doc);
                BufferedImage image = renderer.renderImageWithDPI(0, 150, ImageType.RGB);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(image, "png", baos);
                base64Image = Base64.getEncoder().encodeToString(baos.toByteArray());
            }
            return base64Image;
        }).flatMap(base64Image -> {
            Map<String, Object> body = new HashMap<>();
            body.put("model", "nvidia/nemotron-ocr-v2");
            body.put("max_tokens", 4096);
            
            Map<String, Object> msg = new HashMap<>();
            msg.put("role", "user");
            
            Map<String, Object> contentPart = new HashMap<>();
            contentPart.put("type", "image_url");
            contentPart.put("image_url", Map.of("url", "data:image/png;base64," + base64Image));
            
            msg.put("content", Collections.singletonList(contentPart));
            body.put("messages", Collections.singletonList(msg));
            
            return webClient.post()
                    .uri("https://integrate.api.nvidia.com/v1/chat/completions")
                    .header("Authorization", "Bearer " + nvidiaApiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .map(m -> {
                        try {
                            List<Map<String, Object>> choices = (List<Map<String, Object>>) m.get("choices");
                            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                            return (String) message.get("content");
                        } catch (Exception e) {
                            return "OCR Failed to parse response";
                        }
                    });
        });
    }

    private String resolveModelAndUri(String model, String[] outUri, String[] outKey) {
        if (model != null && model.contains("gemini")) {
            String geminiKey = getGeminiApiKey();
            // If the Gemini key looks like an NVIDIA key (not AIza...), fall back to NVIDIA API
            if (geminiKey != null && !geminiKey.startsWith("AIza")) {
                System.out.println("[AIService] Gemini key not found, falling back to NVIDIA API with model: meta/llama-3.3-70b-instruct");
                outUri[0] = "https://integrate.api.nvidia.com/v1/chat/completions";
                outKey[0] = nvidiaApiKey;
                return "meta/llama-3.3-70b-instruct";
            }
            outUri[0] = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
            outKey[0] = geminiKey;
            if (model.startsWith("google/")) {
                model = model.substring("google/".length());
            }
            return model;
        }
        outUri[0] = "https://integrate.api.nvidia.com/v1/chat/completions";
        outKey[0] = nvidiaApiKey;
        return model != null ? model : "meta/llama-3.3-70b-instruct";
    }

    private Map<String, Object> prepareBody(Map<String, Object> body, String model) {
        Map<String, Object> adjustedBody = new HashMap<>(body);
        adjustedBody.put("model", model);

        List<Map<String, Object>> messages = (List<Map<String, Object>>) adjustedBody.get("messages");
        if (messages != null) {
            for (Map<String, Object> msg : messages) {
                Object content = msg.get("content");
                if (content instanceof List) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) content;
                    StringBuilder textContent = new StringBuilder();
                    for (Map<String, Object> part : parts) {
                        if ("file".equals(part.get("type"))) {
                            try {
                                Map<String, Object> fileObj = (Map<String, Object>) part.get("file");
                                String fileData = (String) fileObj.get("file_data");
                                int commaIndex = fileData.indexOf(",");
                                if (commaIndex != -1) {
                                    String base64Data = fileData.substring(commaIndex + 1);
                                    byte[] pdfBytes = Base64.getDecoder().decode(base64Data);
                                    try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(pdfBytes)) {
                                        PDFTextStripper stripper = new PDFTextStripper();
                                        String extractedText = stripper.getText(doc);
                                        textContent.append("--- PDF DOCUMENT CONTENT ---\n").append(extractedText).append("\n--- END PDF DOCUMENT ---\n");
                                    }
                                }
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        } else if ("text".equals(part.get("type"))) {
                            textContent.append(part.get("text")).append("\n");
                        }
                    }
                    msg.put("content", textContent.toString());
                }
            }
        }
        
        Object toolChoice = adjustedBody.get("tool_choice");
        if (toolChoice instanceof String) {
            String funcName = (String) toolChoice;
            if ("auto".equals(funcName) || "none".equals(funcName)) {
                // leave as string
            } else {
                Map<String, Object> tc = new HashMap<>();
                tc.put("type", "function");
                tc.put("function", Collections.singletonMap("name", funcName));
                adjustedBody.put("tool_choice", tc);
            }
        }
        return adjustedBody;
    }

    public Mono<Map<String, Object>> callAI(Map<String, Object> body) {
        String model = (String) body.get("model");
        String[] outUri = { "" };
        String[] outKey = { "" };
        model = resolveModelAndUri(model, outUri, outKey);
        String uri = outUri[0];
        String key = outKey[0];

        if (key == null || key.trim().isEmpty()) {
            return Mono.error(new IllegalStateException("API Key is not configured for model " + model));
        }

        System.out.println("[AIService] callAI -> model=" + model + ", uri=" + uri + ", keyPrefix=" + key.substring(0, Math.min(8, key.length())) + "...");

        Map<String, Object> adjustedBody = prepareBody(body, model);

        return webClient.post()
                .uri(uri)
                .header("Authorization", "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(adjustedBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                    clientResponse -> clientResponse.bodyToMono(String.class)
                        .defaultIfEmpty("No response body")
                        .flatMap(errorBody -> {
                            System.err.println("[AIService] API Error " + clientResponse.statusCode() + ": " + errorBody);
                            return Mono.error(new RuntimeException("AI API error (" + clientResponse.statusCode() + "): " + errorBody));
                        })
                )
                .bodyToMono(Map.class)
                .map(m -> (Map<String, Object>) m);
    }

    public Flux<String> callAIStream(Map<String, Object> body) {
        String model = (String) body.get("model");
        String[] outUri = { "" };
        String[] outKey = { "" };
        model = resolveModelAndUri(model, outUri, outKey);
        String uri = outUri[0];
        String key = outKey[0];

        if (key == null || key.trim().isEmpty()) {
            return Flux.error(new IllegalStateException("API Key is not configured for model " + model));
        }

        System.out.println("[AIService] callAIStream -> model=" + model + ", uri=" + uri);

        Map<String, Object> adjustedBody = new HashMap<>(body);
        adjustedBody.put("model", model);
        adjustedBody.put("stream", true);

        return webClient.post()
                .uri(uri)
                .header("Authorization", "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(adjustedBody)
                .retrieve()
                .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(),
                    clientResponse -> clientResponse.bodyToMono(String.class)
                        .defaultIfEmpty("No response body")
                        .flatMap(errorBody -> {
                            System.err.println("[AIService] Stream API Error " + clientResponse.statusCode() + ": " + errorBody);
                            return Mono.error(new RuntimeException("AI API error (" + clientResponse.statusCode() + "): " + errorBody));
                        })
                )
                .bodyToFlux(String.class);
    }
}
