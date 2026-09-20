export async function callAI(body: Record<string, any>) {
  const apiKey = Deno.env.get("AI_PROVIDER_API_KEY");
  if (!apiKey) throw new Error("AI_PROVIDER_API_KEY is not configured");

  // Determine the model: AI_MODEL env overrides the per-function default,
  // so a future model retirement only needs a secret change, not a redeploy.
  let model = Deno.env.get("AI_MODEL") || body.model;
  if (typeof model === "string" && model.startsWith("google/")) {
    model = model.substring("google/".length);
  }

  // Check if we need to use Google's native API (for parse-resume with PDF/file content)
  const hasFile = Array.isArray(body.messages) && body.messages.some((msg: any) =>
    Array.isArray(msg.content) && msg.content.some((part: any) => part.type === "file")
  );

  if (hasFile) {
    // Translate from OpenAI-compatible format to Google Native Gemini format
    const nativeBody: Record<string, any> = {};

    // 1. systemInstruction
    const systemMessage = body.messages.find((msg: any) => msg.role === "system");
    if (systemMessage) {
      nativeBody.systemInstruction = {
        parts: [{ text: systemMessage.content }]
      };
    }

    // 2. contents
    const contents: any[] = [];
    for (const msg of body.messages) {
      if (msg.role === "system") continue;
      
      const parts: any[] = [];
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === "file") {
            const fileData = part.file.file_data; // e.g. "data:application/pdf;base64,JVBERi..."
            const commaIndex = fileData.indexOf(",");
            if (commaIndex !== -1) {
              const mimeType = fileData.substring(5, fileData.indexOf(";"));
              const base64Data = fileData.substring(commaIndex + 1);
              parts.push({
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              });
            }
          } else if (part.type === "text") {
            parts.push({ text: part.text });
          }
        }
      } else {
        parts.push({ text: msg.content });
      }

      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: parts
      });
    }
    nativeBody.contents = contents;

    // 3. tools
    if (Array.isArray(body.tools)) {
      nativeBody.tools = [{
        functionDeclarations: body.tools.map((t: any) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    // 4. toolConfig
    if (body.tool_choice) {
      let functionName = "";
      if (typeof body.tool_choice === "string") {
        functionName = body.tool_choice;
      } else if (body.tool_choice.function?.name) {
        functionName = body.tool_choice.function.name;
      }

      if (functionName) {
        nativeBody.toolConfig = {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: [functionName]
          }
        };
      }
    }

    // Call the native generateContent API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(nativeBody)
    });

    if (!response.ok) {
      return response; // Caller will handle response.ok check
    }

    const nativeData = await response.json();
    
    // Translate native response back to OpenAI-compatible format
    const candidate = nativeData.candidates?.[0];
    const part = candidate?.content?.parts?.[0];
    let choices: any[] = [];

    if (part?.functionCall) {
      choices = [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_" + Math.random().toString(36).substring(2, 11),
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args)
            }
          }]
        }
      }];
    } else if (part?.text) {
      choices = [{
        message: {
          role: "assistant",
          content: part.text
        }
      }];
    }

    const openAiResponse = {
      choices: choices
    };

    return new Response(JSON.stringify(openAiResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  // Otherwise, use the standard OpenAI-compatible API
  const adjustedBody = { ...body, model };

  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(adjustedBody),
  });
}
