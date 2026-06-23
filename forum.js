(function () {
    var endpoint = "/.netlify/functions/comments";
    var form = document.getElementById("comment-form");
    var formStatus = document.getElementById("form-status");
    var commentsStatus = document.getElementById("comments-status");
    var commentsList = document.getElementById("comments-list");

    if (!form || !commentsList || !formStatus || !commentsStatus) {
        return;
    }

    function setStatus(element, message, type) {
        element.textContent = message || "";
        element.classList.remove("error", "success");
        if (type) {
            element.classList.add(type);
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
            appendText(commentsList, "p", "empty-comments", "Пока нет комментариев. Можно оставить первый отклик.");
            return;
        }

        comments.forEach(function (comment) {
            var article = document.createElement("article");
            article.className = "comment-card";

            var meta = document.createElement("div");
            meta.className = "comment-meta";
            appendText(meta, "strong", "", comment.displayName || "Анонимно");

            var dateText = formatDate(comment.createdAt);
            if (dateText) {
                appendText(meta, "time", "", dateText);
            }

            article.appendChild(meta);
            appendText(article, "p", "comment-topic", comment.topic || "Без темы");
            appendText(article, "p", "comment-message", comment.message || "");
            commentsList.appendChild(article);
        });
    }

    function loadComments() {
        setStatus(commentsStatus, "Комментарии загружаются...");

        return fetch(endpoint, {
            headers: { "Accept": "application/json" }
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok) {
                        throw new Error(data.error || "Не удалось загрузить комментарии.");
                    }
                    return data;
                });
            })
            .then(function (data) {
                var comments = Array.isArray(data.comments) ? data.comments : [];
                renderComments(comments);
                setStatus(commentsStatus, comments.length ? "" : "Комментариев пока нет.");
            })
            .catch(function (error) {
                renderComments([]);
                setStatus(commentsStatus, error.message || "Не удалось загрузить комментарии.", "error");
            });
    }

    function getPayload() {
        return {
            displayName: form.elements.displayName.value,
            topic: form.elements.topic.value,
            message: form.elements.message.value,
            website: form.elements.website.value
        };
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        var submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;
        setStatus(formStatus, "Комментарий отправляется...");

        fetch(endpoint, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(getPayload())
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok) {
                        throw new Error(data.error || "Не удалось сохранить комментарий.");
                    }
                    return data;
                });
            })
            .then(function () {
                form.reset();
                setStatus(formStatus, "Комментарий сохранен.", "success");
                return loadComments();
            })
            .catch(function (error) {
                setStatus(formStatus, error.message || "Не удалось сохранить комментарий.", "error");
            })
            .finally(function () {
                submitButton.disabled = false;
            });
    });

    loadComments();
})();
