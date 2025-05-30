document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);

    const captureBtn = $("captureBtn");
    const uploadBtn = $("uploadBtn");
    const newChatBtn = $("newChatBtn");
    const sendBtn = $("sendBtn");
    const micBtn = $("micBtn");
    const fileInput = $("fileInput");

    const cameraContainer = $("cameraContainer");
    const cameraFeed = $("cameraFeed");
    const snapBtn = $("snapBtn");
    const closeCameraBtn = $("closeCameraBtn");
    const canvas = $("canvas");
    const ctx = canvas.getContext("2d");

    const chatContainer = $("chatContainer");
    const chatInput = $("chatInput");

    const ocrEditor = $("ocrEditor");
    const ocrTextArea = $("ocrTextArea");
    const rotateBtn = $("rotateBtn");
    const summarizeBtn = $("summarizeBtn");
    const correctBtn = $("correctBtn");
    const submitEditedBtn = $("submitEditedBtn");
    const loader = $("loader");

    let lastOCRText = "";

    function addMessage(sender, message, isImage = false) {
        const messageDiv = document.createElement("div");
        messageDiv.className = sender === "You" ? "user-message" : "bot-message";

        messageDiv.innerHTML = isImage
            ? `<strong>${sender}:</strong><br><img src="${message}" class="chat-image">`
            : `<strong>${sender}:</strong> ${message}`;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        if (sender === "Transcend" && "speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = "en-US";
            speechSynthesis.speak(utterance);
        }
    }

    function addTypingEffect() {
        const typingDiv = document.createElement("div");
        typingDiv.className = "bot-message";
        typingDiv.id = "typingEffect";
        typingDiv.innerHTML = `<strong>Transcend:</strong> <span class="typing">...</span>`;
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function removeTypingEffect() {
        const typingDiv = $("typingEffect");
        typingDiv?.remove();
    }

    function showLoader() {
        loader.style.display = "flex";
    }

    function hideLoader() {
        loader.style.display = "none";
    }

    function sendMessage(text) {
        const message = text || chatInput.value.trim();
        if (!message) return;

        addMessage("You", message);
        chatInput.value = "";
        addTypingEffect();
        showLoader();

        fetch("/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ msg: message }),
        })
            .then((res) => res.json())
            .then((data) => {
                removeTypingEffect();
                hideLoader();
                addMessage("Transcend", data.response || "⚠️ Sorry, I didn't understand that.");
            })
            .catch((err) => {
                console.error("Error:", err);
                removeTypingEffect();
                hideLoader();
                addMessage("Transcend", "⚠️ Error: Unable to process request!");
            });
    }

    function stopCamera() {
        const stream = cameraFeed.srcObject;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        cameraFeed.srcObject = null;
        cameraContainer.style.display = "none";
    }

    function handleImageUpload(file, imageDataUrl, userText = "") {
        const formData = new FormData();
        formData.append("image", file);
        if (userText) formData.append("text", userText);

        addMessage("You", imageDataUrl, true);
        if (userText) addMessage("You", userText);

        addTypingEffect();
        showLoader();

        fetch("/predict", {
            method: "POST",
            body: formData,
        })
            .then((res) => res.json())
            .then((data) => {
                removeTypingEffect();
                hideLoader();
                if (data.extracted_text) handleOCRResponse(data);
                addMessage("Transcend", data.response || "⚠️ No reply received.");
            })
            .catch((err) => {
                console.error("Upload Error:", err);
                removeTypingEffect();
                hideLoader();
                addMessage("Transcend", "⚠️ Error processing image.");
            });
    }

    function handleOCRResponse(data) {
        lastOCRText = data.extracted_text || "";
        ocrTextArea.value = lastOCRText;
        ocrEditor.style.display = "block";
    }

    // Event Listeners
    sendBtn?.addEventListener("click", () => sendMessage());
    chatInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });

    micBtn?.addEventListener("click", () => {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = "en-US";
        recognition.start();
        recognition.onresult = (event) => {
            chatInput.value = event.results[0][0].transcript;
        };
    });

    captureBtn?.addEventListener("click", async () => {
        try {
            cameraContainer.style.display = "flex";
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            cameraFeed.srcObject = stream;
        } catch (err) {
            alert("Camera access denied!");
            console.error(err);
        }
    });

    snapBtn?.addEventListener("click", () => {
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");

        fetch(dataUrl)
            .then((res) => res.blob())
            .then((blob) => {
                const file = new File([blob], "camera-capture.png", { type: "image/png" });
                handleImageUpload(file, dataUrl, chatInput.value.trim());
                chatInput.value = "";
            });

        stopCamera();
    });

    closeCameraBtn?.addEventListener("click", stopCamera);

    uploadBtn?.addEventListener("click", () => fileInput.click());

    fileInput?.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                handleImageUpload(file, e.target.result, chatInput.value.trim());
                chatInput.value = "";
                fileInput.value = "";
            };
            reader.readAsDataURL(file);
        }
    });

    newChatBtn?.addEventListener("click", () => {
        chatContainer.innerHTML = "";
        ocrEditor.style.display = "none";
        addMessage("Transcend", "🆕 New chat started. How can I assist you?");
    });

    submitEditedBtn?.addEventListener("click", () => {
        const editedText = ocrTextArea.value;
        sendMessage(editedText);
        ocrEditor.style.display = "none";
    });

    summarizeBtn?.addEventListener("click", () => {
        ocrTextArea.value = `Summarize this:\n\n${ocrTextArea.value}`;
    });

    correctBtn?.addEventListener("click", () => {
        ocrTextArea.value = `Fix grammar and spelling:\n\n${ocrTextArea.value}`;
    });

    rotateBtn?.addEventListener("click", () => {
        alert("🌀 Rotation coming soon! This needs advanced canvas manipulation.");
    });

    document.addEventListener("click", (event) => {
        if (event.target.classList.contains("chat-image")) {
            const lightbox = $("lightbox");
            const lightboxImg = lightbox.querySelector("img");
            lightboxImg.src = event.target.src;
            lightbox.style.display = "flex";
        }
    });
    
    // Initial welcome message
    addMessage("Transcend", "👋 Hello! I’m Transcend. Ask me anything, or upload a handwritten image.");
});
