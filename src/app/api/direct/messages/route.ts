import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ensureSameAuthenticatedUser, getApiErrorStatus, requireAuthenticatedUserId, sanitizeDirectMessageForApi } from "@/lib/api-auth";
import { createDirectMessage, listDirectMessagesPage } from "@/lib/store";

// Limites configuráveis via .env
const MAX_MESSAGE_LENGTH = Number(process.env.NEXT_PUBLIC_MAX_MESSAGE_LENGTH ?? "2000");
const DEFAULT_MAX_FILE_SIZE = (Number(process.env.CHANNEL_UPLOAD_MAX_FILE_SIZE_MB ?? "50")) * 1024 * 1024;

const createDirectMessageSchema = z.object({
  userId: z.string().trim().min(2),
  content: z.string().trim().max(MAX_MESSAGE_LENGTH),
  conversationId: z.string().trim().optional(),
  targetUserId: z.string().trim().optional(),
});

const getMaxFileSize = (): number => {
  const rawValue = process.env.CHANNEL_UPLOAD_MAX_FILE_SIZE_MB ?? process.env.NEXT_PUBLIC_CHANNEL_UPLOAD_MAX_FILE_SIZE_MB;
  const parsedMb = Number(rawValue);
  if (!Number.isFinite(parsedMb) || parsedMb <= 0) {
    return DEFAULT_MAX_FILE_SIZE;
  }

  return Math.floor(parsedMb * 1024 * 1024);
};

const MAX_FILE_SIZE = getMaxFileSize();
const MAX_FILE_SIZE_MB_LABEL = `${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")}`;

const sanitizeFileName = (name: string): string =>
  name
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120) || "arquivo";

const saveUploadedFile = async (file: File): Promise<{ name: string; size: number; url: string }> => {
  if (file.size <= 0) {
    throw new Error("Arquivo vazio não é permitido.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo ${file.name} excede ${MAX_FILE_SIZE_MB_LABEL}MB.`);
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "direct");
  await mkdir(uploadsDir, { recursive: true });

  const extension = path.extname(file.name);
  const baseName = path.basename(file.name, extension);
  const safeBaseName = sanitizeFileName(baseName);
  const finalFileName = `${Date.now()}-${crypto.randomUUID()}-${safeBaseName}${extension}`;
  const finalPath = path.join(uploadsDir, finalFileName);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(finalPath, fileBuffer);

  return {
    name: file.name,
    size: file.size,
    url: `/uploads/direct/${finalFileName}`,
  };
};

export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const beforeCreatedAt = request.nextUrl.searchParams.get("beforeCreatedAt") ?? undefined;
  const beforeId = request.nextUrl.searchParams.get("beforeId") ?? undefined;

  if (!conversationId) {
    return NextResponse.json({ error: "Parâmetro conversationId é obrigatório." }, { status: 400 });
  }

  try {
    const authenticatedUserId = requireAuthenticatedUserId(request);
    const userId = request.nextUrl.searchParams.get("userId");
    if (userId) {
      ensureSameAuthenticatedUser(authenticatedUserId, userId);
    }

    const page = await listDirectMessagesPage(conversationId, authenticatedUserId, {
      limit,
      beforeCreatedAt,
      beforeId,
    });
    return NextResponse.json(page);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao buscar mensagens diretas." },
      { status: getApiErrorStatus(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUserId = requireAuthenticatedUserId(request);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const userId = z.string().trim().min(2).parse(formData.get("userId")?.toString());
      ensureSameAuthenticatedUser(authenticatedUserId, userId);
      const conversationId = z.string().trim().optional().parse(formData.get("conversationId")?.toString());
      const targetUserId = z.string().trim().optional().parse(formData.get("targetUserId")?.toString());
      const content = z.string().max(MAX_MESSAGE_LENGTH).parse(formData.get("content")?.toString() ?? "");
      const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.name.length > 0);

      const trimmedContent = content.trim();
      if (!trimmedContent && files.length === 0) {
        return NextResponse.json({ error: "Envie texto, link ou arquivo." }, { status: 400 });
      }

      const attachments = await Promise.all(files.map((file) => saveUploadedFile(file)));
      const attachmentLines = attachments.map(
        (attachment) => `[file]|${attachment.name}|${attachment.size}|${attachment.url}`,
      );
      const composedContent = [trimmedContent, ...attachmentLines].filter(Boolean).join("\n");

      const result = await createDirectMessage(authenticatedUserId, {
        content: composedContent,
        conversationId,
        targetUserId,
      });

      const sanitized = {
        ...result,
        message: sanitizeDirectMessageForApi(result.message),
      };
      return NextResponse.json(sanitized, { status: 201 });
    }

    const body = createDirectMessageSchema.parse(await request.json());
    ensureSameAuthenticatedUser(authenticatedUserId, body.userId);

    if (!body.content) {
      return NextResponse.json({ error: "Conteúdo da mensagem não pode ser vazio." }, { status: 400 });
    }

    const result = await createDirectMessage(authenticatedUserId, {
      content: body.content,
      conversationId: body.conversationId,
      targetUserId: body.targetUserId,
    });

    const sanitized = {
      ...result,
      message: sanitizeDirectMessageForApi(result.message),
    };
    return NextResponse.json(sanitized, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao enviar mensagem direta." },
      { status: getApiErrorStatus(error) },
    );
  }
}
