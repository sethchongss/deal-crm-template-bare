import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import mammoth from "mammoth";
import { EXTRACT_INSTRUCTIONS, extractedDealSchema } from "@/lib/extract-deal";
import { requireTeamApi } from "@/lib/team-access";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

const INSTRUCTIONS = EXTRACT_INSTRUCTIONS;

function gatewayMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Couldn't read that document.";
  if (/OIDC|AI_GATEWAY|AI Gateway|api key|Unauthorized|authentication/i.test(message)) {
    return "Document reading needs AI Gateway on this Vercel project. You can still fill the form by hand.";
  }
  return "Couldn't read that document. You can still fill the form by hand.";
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireTeamApi();
  if (unauthorized) return unauthorized;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a PDF or Word document." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "That file is over 12MB. Try a smaller PDF or paste the key pages." }, { status: 413 });
    }

    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    const isDocx = name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isPdf && !isDocx) {
      return NextResponse.json({ error: "Use a PDF or a .docx file. Older .doc files need to be saved as .docx first." }, { status: 415 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const prompt = `${INSTRUCTIONS}\n\nFile name: ${file.name}`;
    const result = isPdf
      ? await generateText({
          model: "anthropic/claude-sonnet-4.6",
          output: Output.object({ schema: extractedDealSchema, name: "DealExtract" }),
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "file", data: bytes, mediaType: "application/pdf", filename: file.name },
            ],
          }],
        })
      : await generateText({
          model: "anthropic/claude-sonnet-4.6",
          output: Output.object({ schema: extractedDealSchema, name: "DealExtract" }),
          prompt: `${prompt}\n\nDocument text:\n${(await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value.slice(0, 80_000)}`,
        });

    if (!result.output) {
      return NextResponse.json({ error: "The document was read, but no deal fields came back. Fill the form by hand." }, { status: 422 });
    }
    return NextResponse.json({ deal: result.output });
  } catch (error) {
    console.error("extract-deal", error);
    const message = gatewayMessage(error);
    const status = /AI Gateway/.test(message) ? 503 : 422;
    return NextResponse.json({ error: message }, { status });
  }
}
