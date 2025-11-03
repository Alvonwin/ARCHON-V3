#!/usr/bin/env python3
"""
🌉 Claude Code HTTP Bridge
Serveur HTTP qui fait le pont entre ARCHON V3 et Claude Code
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import time
import os
import threading

app = Flask(__name__)
CORS(app)  # Autoriser les requêtes depuis Vercel

# Fichier pour la conversation
CONVERSATION_FILE = r"E:\Mémoire Claude\current_conversation.txt"
RESPONSE_MARKER = "## Claude:"

# Variable pour stocker la dernière position lue
last_position = 0
pending_requests = {}  # {request_id: {"message": str, "response": None, "timestamp": float}}
request_counter = 0
request_lock = threading.Lock()

def send_to_claude(message):
    """Ecrit le message directement dans le fichier conversation"""
    try:
        # Lire le contenu actuel
        content = ""
        if os.path.exists(CONVERSATION_FILE):
            with open(CONVERSATION_FILE, 'r', encoding='utf-8') as f:
                content = f.read()

        # Ajouter le nouveau message avec le format attendu
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        new_message = f"\n\n## Alain: [{timestamp}]\n{message}\n"

        # Ecrire dans le fichier
        with open(CONVERSATION_FILE, 'a', encoding='utf-8') as f:
            f.write(new_message)

        print(f"[BRIDGE] Message written to conversation file")
        return "Message written successfully"

    except Exception as e:
        print(f"[BRIDGE] Error writing to conversation file: {e}")
        return None

def wait_for_response(timeout=60):
    """Attend la réponse de Claude dans le fichier conversation"""
    global last_position

    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            if not os.path.exists(CONVERSATION_FILE):
                time.sleep(0.5)
                continue

            with open(CONVERSATION_FILE, 'r', encoding='utf-8') as f:
                f.seek(last_position)
                new_content = f.read()

                if RESPONSE_MARKER in new_content:
                    # Trouver la dernière réponse de Claude
                    responses = new_content.split(RESPONSE_MARKER)
                    if len(responses) > 1:
                        last_response = responses[-1].strip()
                        # Nettoyer la réponse (retirer le prochain ## Alain: si présent)
                        if "## Alain:" in last_response:
                            last_response = last_response.split("## Alain:")[0].strip()

                        # Mettre à jour la position
                        last_position = f.tell()

                        return last_response

        except Exception as e:
            print(f"❌ Error reading conversation: {e}")

        time.sleep(0.5)

    return None

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de santé"""
    return jsonify({
        "status": "ok",
        "service": "Claude Code Bridge",
        "version": "1.0"
    })

@app.route('/message', methods=['POST'])
def send_message():
    """Envoie un message à Claude et attend la réponse"""
    global request_counter, last_position

    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({"error": "No message provided"}), 400

    message = data['message']

    print(f"[BRIDGE] Received message: {message[:50]}...")

    # Initialiser la position si c'est le premier message
    if last_position == 0 and os.path.exists(CONVERSATION_FILE):
        with open(CONVERSATION_FILE, 'r', encoding='utf-8') as f:
            f.seek(0, 2)  # Aller à la fin
            last_position = f.tell()

    # Envoyer le message à Claude
    send_result = send_to_claude(message)

    if not send_result:
        return jsonify({
            "error": "Failed to write message to conversation file",
            "suggestion": "Check if conversation file path is accessible"
        }), 503

    # Attendre la réponse
    print("[BRIDGE] Waiting for Claude's response...")
    response = wait_for_response(timeout=60)

    if response:
        print(f"[BRIDGE] Got response: {response[:50]}...")
        return jsonify({
            "response": response,
            "status": "success"
        })
    else:
        print("[BRIDGE] Timeout waiting for response")
        return jsonify({
            "error": "Timeout waiting for response",
            "suggestion": "Claude might be busy or didn't respond in time"
        }), 504

if __name__ == '__main__':
    print("[BRIDGE] Claude Code Bridge starting...")
    print(f"[BRIDGE] Conversation file: {CONVERSATION_FILE}")
    print("[BRIDGE] Server running on http://localhost:3334")

    app.run(host='0.0.0.0', port=3334, debug=False)
