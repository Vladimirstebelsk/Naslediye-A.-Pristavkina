(function () {
    var endpoint = "/.netlify/functions/comments";
    var form = document.getElementById("admin-token-form");
    var tokenInput = document.getElementById("admin-token");
    var statusElement = document.getElementById("admin-status");
    var commentsList = document.getElementById("admin-comments-list");
    var adminToken = "";

    if (!form || !tokenInput || !statusElement || !commentsList) {
        return;
    }

    function setStatus(message, type) {
        statusElement.textContent = message || "";
        statusElement.classList.remove("error", "success");
        if (type) {
            statusElement.classList.add(type);
        }
    }

    function formatDate(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function appendText(parent, tagName, className, text) {
        var element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function renderComments(comments) {
        commentsList.replaceChildren();

        if (!comments.length) {
            appendText(commentsList, "p", "empty-comments", "Комментариев пока нет.");
            return;
        }

        comments.forEach(function (comment) {
            var article = document.createElement("article");
            article.className = "comment-card admin-comment-card";

            var meta = document.createElement("div");
            meta.className = "comment-meta";
            appendText(meta, "strong", "", comment.displayName || "Анонимно");

            var dateText = formatDate(comment.createdAt);
            if (dateText) {
                appendText(meta, "time", "", dateText);
            }

            var actions = document.createElement("div");
            actions.className = "admin-comment-actions";

            var deleteButton = document.createElement("button");
            deleteButton.className = "button-link secondary";
            deleteButton.type = "button";
            deleteButton.textContent = "Удалить";
            deleteButton.addEventListener("click", function () {
                deleteComment(comment.id, deleteButton);
            });

            actions.appendChild(deleteButton);
            article.appendChild(meta);
            appendText(article, "p", "comment-message", comment.message || "");
            article.appendChild(actions);
            commentsList.appendChild(article);
        });
    }

    function parseJsonResponse(response) {
        return response.json().then(function (data) {
            if (!response.ok) {
                throw new Error(data.error || "Запрос не выполнен.");
            }
            return data;
        });
    }

    function loadComments() {
        setStatus("Комментарии загружаются...");

        return fetch(endpoint, {
            headers: { "Accept": "application/json" }
        })
            .then(parseJsonResponse)
            .then(function (data) {
                var comments = Array.isArray(data.comments) ? data.comments : [];
                renderComments(comments);
                setStatus(comments.length ? "Комментарии загружены." : "Комментариев пока нет.", "success");
            })
            .catch(function (error) {
                renderComments([]);
                setStatus(error.message || "Не удалось загрузить комментарии.", "error");
            });
    }

    function deleteComment(id, button) {
        if (!adminToken || !id) {
            setStatus("Введите токен модератора.", "error");
            return;
        }

        button.disabled = true;
        setStatus("Комментарий удаляется...");

        fetch(endpoint + "?id=" + encodeURIComponent(id), {
            method: "DELETE",
            headers: {
                "Accept": "application/json",
                "x-admin-token": adminToken
            }
        })
            .then(parseJsonResponse)
            .then(function () {
                setStatus("Комментарий удален.", "success");
                return loadComments();
            })
            .catch(function (error) {
                setStatus(error.message || "Не удалось удалить комментарий.", "error");
            })
            .finally(function () {
                button.disabled = false;
            });
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        adminToken = tokenInput.value.trim();

        if (!adminToken) {
            setStatus("Введите токен модератора.", "error");
            return;
        }

        loadComments();
    });
})();
