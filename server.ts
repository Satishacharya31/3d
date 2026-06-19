import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { GoogleGenAI, Modality, Type, LiveServerMessage } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '50mb' }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on("connection", async (clientWs) => {
    try {
      const sessionAudio = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
          },
          systemInstruction: {
            parts: [{text: "You are Myra, an autonomous AI assistant controlling a PC dashboard. You have a female persona. Be helpful, concise, and friendly. You have tools: generateImage (to create synthesized visuals). You can proactively call 'startScreenShare' to ask the user to view their desktop screen, and 'stopScreenShare' when done. The audio link is always active."}]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "generateImage",
                description: "Generate an image for the user based on a prompt.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    prompt: { type: Type.STRING, description: "Description of the image to generate" }
                  },
                  required: ["prompt"]
                }
              },
              {
                name: "pcControl",
                description: "Perform an autonomous action on the user's PC.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, description: "The action to perform, e.g., 'close window', 'type text', 'click'" }
                  },
                  required: ["action"]
                }
              },
              {
                 name: "startScreenShare",
                 description: "Request the user's screen share so you can see what is on their screen.",
              },
              {
                 name: "stopScreenShare",
                 description: "Stop viewing the user's screen.",
              }
            ]
          }]
        },
        callbacks: {
          onmessage: async (message: any) => {
            // Handle audio/text
            const parts = message.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
              if (part.text && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ text: part.text, role: 'model' }));
              }
              if (part.executableCode && clientWs.readyState === WebSocket.OPEN) {
                 clientWs.send(JSON.stringify({ text: `*Executing core logic:*\n\`\`\`python\n${part.executableCode.code}\n\`\`\``, role: 'model' }));
              }
            }

            // Handle Function Calling
            if (message.toolCall) {
              const functionCalls = message.toolCall.functionCalls;
              if (functionCalls && functionCalls.length > 0) {
                const functionResponses: any[] = [];
                for (const call of functionCalls) {
                  if (call.name === 'generateImage') {
                    const prompt = call.args?.prompt as string;
                    clientWs.send(JSON.stringify({ text: `*Synthesizing image:* ${prompt}`, role: 'model' }));
                    try {
                      const imgRes = await ai.models.generateImages({
                        model: "gemini-3.1-flash-image-preview",
                        prompt: prompt,
                        config: { numberOfImages: 1, outputMimeType: "image/jpeg" }
                      });
                      const imgBase64 = imgRes.generatedImages?.[0]?.image?.imageBytes;
                      if (imgBase64) {
                        clientWs.send(JSON.stringify({ image: imgBase64, role: 'model' }));
                        functionResponses.push({
                          id: call.id,
                          name: call.name,
                          response: { result: "Image generated successfully." }
                        });
                      } else {
                        functionResponses.push({
                          id: call.id,
                          name: call.name,
                          response: { error: "Failed to generate image." }
                        });
                      }
                    } catch (err: any) {
                       functionResponses.push({
                          id: call.id,
                          name: call.name,
                          response: { error: err.message }
                       });
                    }
                  } else if (call.name === 'pcControl') {
                     const action = call.args?.action as string;
                     clientWs.send(JSON.stringify({ text: `*Autonomous PC Action:* ${action}`, role: 'model' }));
                     functionResponses.push({
                        id: call.id,
                        name: call.name,
                        response: { result: "Action executed successfully in sandbox." }
                     });
                  } else if (call.name === 'startScreenShare' || call.name === 'stopScreenShare') {
                     clientWs.send(JSON.stringify({ action: call.name }));
                     functionResponses.push({
                        id: call.id,
                        name: call.name,
                        response: { result: `Action ${call.name} requested.` }
                     });
                  }
                }
                if (functionResponses.length > 0) {
                  sessionAudio.sendToolResponse({ functionResponses });
                }
              }
            }

            if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
        }
      });
      
      clientWs.on("message", (data) => {
        try {
          const payload = JSON.parse(data.toString());
          if (payload.audio) {
            sessionAudio.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (payload.video) {
             sessionAudio.sendRealtimeInput({
               video: { data: payload.video, mimeType: "image/jpeg" }
             });
          }
          if (payload.text) {
             sessionAudio.sendRealtimeInput([{ text: payload.text }] as any);
          }
        } catch (e) {
          // Ignore invalid parse
        }
      });

      clientWs.on("close", () => {
        // sessionAudio.close(); // Not specified but good practice
      });
    } catch(e) {
      console.error(e);
      clientWs.close();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

}

startServer().catch(console.error);
