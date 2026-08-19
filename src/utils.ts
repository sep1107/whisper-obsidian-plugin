export function getCursorContext(
	editor: { getValue: () => string; getCursor: () => { line: number } },
	contextLines: number = 5
): string {
	const lines = editor.getValue().split("\n");
	const cursorLine = editor.getCursor().line;
	const start = Math.max(0, cursorLine - contextLines);
	const end = Math.min(lines.length, cursorLine + contextLines + 1);
	return lines.slice(start, end).join("\n").trim();
}

export function getExtensionFromMimeType(mimeType: string | undefined): string {
	if (!mimeType) return "webm";
	const base = mimeType.split(";")[0];
	const subtype = base.split("/")[1];
	const extensionMap: Record<string, string> = {
		"mp4a.40.2": "m4a",
		mpeg: "mp3",
		"x-m4a": "m4a",
	};
	return extensionMap[subtype] || subtype;
}

export interface TemplateVariables {
	date: string;
	time: string;
	datetime: string;
	title: string;
	transcription: string;
	audioFile: string;
}

export function buildTemplateVariables(
	transcription: string,
	title: string,
	audioFilePath: string
): TemplateVariables {
	const now = new Date();
	const date = now.toISOString().split("T")[0];
	const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
	const datetime = `${date} ${now.toTimeString().split(" ")[0]}`;
	return {
		date,
		time,
		datetime,
		title,
		transcription,
		audioFile: audioFilePath,
	};
}

export function resolveTemplate(
	template: string,
	vars: TemplateVariables
): string {
	return template
		.replace(/\{\{date\}\}/g, vars.date)
		.replace(/\{\{time\}\}/g, vars.time)
		.replace(/\{\{datetime\}\}/g, vars.datetime)
		.replace(/\{\{title\}\}/g, vars.title)
		.replace(/\{\{transcription\}\}/g, vars.transcription)
		.replace(/\{\{audioFile\}\}/g, vars.audioFile);
}

export function getBaseFileName(filePath: string) {
	const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
	const dotIndex = fileName.lastIndexOf(".");
	return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
}

export interface WhisperSegment {
	start?: number;
	text?: string;
}

export interface WhisperTranscription {
	text?: string;
	segments?: WhisperSegment[];
}

export function getOriginalTranscription(
	data: string | WhisperTranscription
): string {
	const text = typeof data === "string" ? data : data?.text ?? "";
	return text.replace(/\s*\n+\s*/g, " ").trim();
}

function formatTranscriptTimestamp(seconds: number | undefined): string {
	const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const remainingSeconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, "0")}:${String(
			remainingSeconds
		).padStart(2, "0")}`;
	}
	return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function renderTimestampedTranscription(
	data: string | WhisperTranscription
): string {
	const fallback = getOriginalTranscription(data);
	if (typeof data === "string" || !Array.isArray(data.segments)) {
		return fallback;
	}

	const paragraphs = data.segments
		.map((segment) => {
			const text = segment.text?.trim() ?? "";
			return text
				? `**${formatTranscriptTimestamp(segment.start)}** · ${text}`
				: "";
		})
		.filter(Boolean);

	return paragraphs.length > 0 ? paragraphs.join("\n\n") : fallback;
}

const TIMESTAMP_PREFIX = /^\s*\*\*\d+:\d{2}(?::\d{2})?\*\*\s*·\s*/;

export function ensureTimestampedParagraphs(
	text: string,
	data: string | WhisperTranscription
): string {
	if (typeof data === "string" || !Array.isArray(data.segments)) {
		return text.trim();
	}

	const segments = data.segments.filter((segment) => segment.text?.trim());
	let paragraphs = text
		.trim()
		.split(/\n\s*\n+/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

	if (segments.length === 0 || paragraphs.length === 0) {
		return paragraphs.join("\n\n");
	}
	if (
		paragraphs.length > 1 &&
		paragraphs.every((paragraph) => TIMESTAMP_PREFIX.test(paragraph))
	) {
		return paragraphs.join("\n\n");
	}

	paragraphs = paragraphs.map((paragraph) =>
		paragraph.replace(TIMESTAMP_PREFIX, "")
	);
	if (paragraphs.length === 1) {
		const sentences =
			paragraphs[0]
				.match(/[^。！？!?]+[。！？!?]+|[^。！？!?]+$/g)
				?.map((sentence) => sentence.trim())
				.filter(Boolean) ?? [];
		if (sentences.length > 3) {
			paragraphs = [];
			for (let index = 0; index < sentences.length; index += 3) {
				paragraphs.push(sentences.slice(index, index + 3).join(""));
			}
		}
	}

	const outputLength = paragraphs.reduce(
		(total, paragraph) => total + paragraph.length,
		0
	);
	const sourceLength = segments.reduce(
		(total, segment) => total + (segment.text?.trim().length ?? 0),
		0
	);
	let outputOffset = 0;

	return paragraphs
		.map((paragraph) => {
			const sourceOffset = outputLength
				? (outputOffset / outputLength) * sourceLength
				: 0;
			let consumed = 0;
			const segment =
				segments.find((candidate) => {
					consumed += candidate.text?.trim().length ?? 0;
					return sourceOffset < consumed;
				}) ?? segments[segments.length - 1];
			outputOffset += paragraph.length;
			return `**${formatTranscriptTimestamp(
				segment.start
			)}** · ${paragraph}`;
		})
		.join("\n\n");
}
