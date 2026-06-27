const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const STORE_NAME = "forum-comments";
const COMMENTS_KEY = "comments.json";
const LOCAL_COMMENTS_PATH = process.env.FORUM_COMMENTS_PATH || path.join(os.tmpdir(), "naslediye-pristavkina-comments.json");
const MAX_NAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 1000;
const JSON_HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
};

let cachedStore;
let storeResolved = false;

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: JSON_HEADERS,
        body: JSON.stringify(body)
    };
}

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isLocalStorageMode() {
    return process.env.NETLIFY_DEV === "true" || process.env.FORUM_STORAGE === "local";
}

function getStorageMode() {
    return isLocalStorageMode() ? "local-file" : "netlify-blobs";
}

function logStorageMode() {
    console.log("comments storage mode:", getStorageMode());
}

async function getBlobStore() {
    if (storeResolved) {
        return cachedStore;
    }

    const { getStore } = await import("@netlify/blobs");
    cachedStore = getStore(STORE_NAME);

    if (!cachedStore) {
        throw new Error("Netlify Blobs store is unavailable.");
    }

    storeResolved = true;
    return cachedStore;
}

function sortComments(comments) {
    return comments.slice().sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
}

function normalizeStoredComment(comment) {
    return {
        id: comment.id,
        createdAt: comment.createdAt,
        displayName: comment.displayName || "Анонимно",
        message: comment.message || ""
    };
}

function normalizeStoredComments(comments) {
    return sortComments(comments).map(normalizeStoredComment);
}

async function readComments() {
    if (getStorageMode() === "local-file") {
        return readLocalComments();
    }

    const store = await getBlobStore();
    const comments = await store.get(COMMENTS_KEY, { type: "json" });
    return Array.isArray(comments) ? normalizeStoredComments(comments) : [];
}

async function readLocalComments() {
    try {
        const content = await fs.readFile(LOCAL_COMMENTS_PATH, "utf8");
        const comments = JSON.parse(content);
        return Array.isArray(comments) ? normalizeStoredComments(comments) : [];
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

async function writeComments(comments) {
    const sortedComments = normalizeStoredComments(comments);

    if (getStorageMode() === "local-file") {
        await writeLocalComments(sortedComments);
        return sortedComments;
    }

    const store = await getBlobStore();
    await store.setJSON(COMMENTS_KEY, sortedComments);
    return sortedComments;
}

async function writeLocalComments(sortedComments) {
    await fs.mkdir(path.dirname(LOCAL_COMMENTS_PATH), { recursive: true });
    await fs.writeFile(LOCAL_COMMENTS_PATH, JSON.stringify(sortedComments, null, 2), "utf8");
}

function countUrls(message) {
    const matches = message.match(/https?:\/\/|www\./gi);
    return matches ? matches.length : 0;
}

function validateComment(payload) {
    const displayName = normalizeString(payload.displayName) || "Анонимно";
    const message = normalizeString(payload.message);

    if (displayName.length > MAX_NAME_LENGTH) {
        return { error: "Имя должно быть не длиннее 40 символов." };
    }

    if (!message) {
        return { error: "Комментарий не может быть пустым." };
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
        return { error: "Комментарий должен быть не длиннее 1000 символов." };
    }

    if (countUrls(message) > 1) {
        return { error: "Комментарий не сохранен: слишком много ссылок." };
    }

    return {
        comment: {
            id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex"),
            createdAt: new Date().toISOString(),
            displayName,
            message
        }
    };
}

function getHeader(headers, name) {
    if (!headers) {
        return "";
    }

    const requestedName = name.toLowerCase();
    const matchedHeader = Object.keys(headers).find((key) => key.toLowerCase() === requestedName);
    return matchedHeader ? headers[matchedHeader] : "";
}

function hasValidAdminToken(event) {
    const configuredToken = normalizeString(process.env.FORUM_ADMIN_TOKEN);
    const requestToken = normalizeString(getHeader(event.headers, "x-admin-token"));
    return Boolean(configuredToken) && requestToken === configuredToken;
}

async function deleteComment(event) {
    if (!hasValidAdminToken(event)) {
        return jsonResponse(401, { error: "Неверный токен модератора." });
    }

    const id = normalizeString(event.queryStringParameters && event.queryStringParameters.id);
    if (!id) {
        return jsonResponse(400, { error: "Не указан id комментария." });
    }

    try {
        const comments = await readComments();
        const updatedComments = comments.filter((comment) => comment.id !== id);

        if (updatedComments.length === comments.length) {
            return jsonResponse(404, { error: "Комментарий не найден." });
        }

        await writeComments(updatedComments);
        return jsonResponse(200, { ok: true, deleted: id });
    } catch (error) {
        console.error(error);
        return jsonResponse(500, { error: "Не удалось удалить комментарий." });
    }
}

exports.handler = async function handler(event) {
    logStorageMode();

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: JSON_HEADERS, body: "" };
    }

    if (event.httpMethod === "GET") {
        try {
            const comments = await readComments();
            return jsonResponse(200, { order: "oldest-first", storage: getStorageMode(), comments });
        } catch (error) {
            console.error(error);
            return jsonResponse(500, { error: "Не удалось загрузить комментарии.", storage: getStorageMode() });
        }
    }

    if (event.httpMethod === "DELETE") {
        return deleteComment(event);
    }

    if (event.httpMethod !== "POST") {
        return jsonResponse(405, { error: "Метод не поддерживается." });
    }

    let payload;
    try {
        payload = JSON.parse(event.body || "{}");
    } catch (error) {
        return jsonResponse(400, { error: "Некорректный JSON." });
    }

    if (normalizeString(payload.website)) {
        return jsonResponse(200, { ok: true, stored: false });
    }

    const validation = validateComment(payload);
    if (validation.error) {
        return jsonResponse(400, { error: validation.error });
    }

    try {
        const comments = await readComments();
        comments.push(validation.comment);
        await writeComments(comments);
        return jsonResponse(201, { ok: true, comment: validation.comment });
    } catch (error) {
        console.error(error);
        return jsonResponse(500, { error: "Не удалось сохранить комментарий." });
    }
};
