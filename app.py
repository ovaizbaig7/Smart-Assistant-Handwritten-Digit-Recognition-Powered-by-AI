from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_pymongo import PyMongo
from werkzeug.security import generate_password_hash, check_password_hash
from gpt4all import GPT4All
from google.cloud import vision
from datetime import datetime
import os

# ==== Configuration ====
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\ovaiz\OneDrive\Desktop\PROJECTS\MAJOR\Codes\Transcend\sonic-ivy-459106-k0-6cb4ddafd2c4.json"

app = Flask(__name__)

# ✅ MongoDB connection updated
app.config["MONGO_URI"] = "mongodb+srv://ovaiz:olbaig27%40@transcend.pdtoifq.mongodb.net/transcend_db"
mongo = PyMongo(app)

# GPT4All model
model = GPT4All("phi-2.Q4_K_M.gguf", model_path="models", n_ctx=2048)

# Google Vision client
vision_client = vision.ImageAnnotatorClient()

# ==== Utility Functions ====

def get_chatbot_response(user_input):
    try:
        prompt = (
            "You are an intelligent assistant. First, correct any spelling or grammar mistakes "
            "in the user's input. Then respond clearly and helpfully.\n\n"
            f"User's message: {user_input}\n\nAssistant:"
        )
        response = model.generate(prompt, max_tokens=250)
        return response.strip()
    except Exception as e:
        return f"Error: {str(e)}"

# ==== Routes ====

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        name = request.form.get("name")
        email = request.form.get("email").lower()
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")

        if password != confirm_password:
            flash("❌ Passwords do not match!", "error")
            return redirect(url_for("signup"))

        if mongo.db.users.find_one({"email": email}):
            flash("⚠️ Email already registered.", "error")
            return redirect(url_for("signup"))

        hashed_pw = generate_password_hash(password)
        mongo.db.users.insert_one({
            "name": name,
            "email": email,
            "password": hashed_pw
        })

        flash("✅ Signup successful. Please login.", "success")
        return redirect(url_for("login"))

    return render_template("signup.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email").lower()
        password = request.form.get("password")

        user = mongo.db.users.find_one({"email": email})
        if user and check_password_hash(user["password"], password):
            session["user"] = user["email"]
            return redirect(url_for("index"))
        else:
            flash("❌ Invalid credentials.", "error")
            return redirect(url_for("login"))

    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/index")
def index():
    if "user" not in session:
        return redirect(url_for("login"))
    return render_template("index.html")

@app.route("/upload", methods=["POST"])
def upload_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    image_bytes = file.read()

    image = vision.Image(content=image_bytes)
    response = vision_client.document_text_detection(image=image)
    extracted_text = response.full_text_annotation.text.strip()

    chatbot_reply = get_chatbot_response(extracted_text)

    mongo.db.chats.insert_one({
        "user_message": extracted_text,
        "bot_reply": chatbot_reply,
        "source": "image_upload",
        "timestamp": datetime.utcnow()
    })

    return jsonify({
        "extracted": extracted_text,
        "reply": chatbot_reply
    })

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    user_message = data.get("message", "")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    chatbot_reply = get_chatbot_response(user_message)

    mongo.db.chats.insert_one({
        "user_message": user_message,
        "bot_reply": chatbot_reply,
        "source": "text_input",
        "timestamp": datetime.utcnow()
    })

    return jsonify({"reply": chatbot_reply})

@app.route("/chatlog", methods=["GET"])
def get_chatlog():
    chats = list(mongo.db.chats.find({}, {"_id": 0}).sort([("_id", -1)]).limit(50))
    chats.reverse()
    return jsonify(chats)

@app.route("/clearlog", methods=["POST"])
def clear_chatlog():
    mongo.db.chats.delete_many({})
    return jsonify({"status": "Chat log cleared"})

# ==== Start Server ====
if __name__ == "__main__":
    app.run(debug=True)
