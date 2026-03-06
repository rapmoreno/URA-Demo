#!/bin/bash

# URA Website Startup Script
# Handles port management, chatbot backend, and main site serving

echo "🚀 Starting URA Website with Chatbot..."

# Weird port numbers for safety
MAIN_PORT=7394
CHATBOT_PORT=8267

echo "📡 Using ports: Main Site: $MAIN_PORT, Chatbot: $CHATBOT_PORT"

# Port killer function - kill any stubborn processes on our ports
kill_port() {
    local port=$1
    echo "🔪 Killing any processes on port $port..."
    
    # Kill processes using the port (multiple methods for stubborn ports)
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    pkill -f "port.*$port" 2>/dev/null || true
    
    # Extra stubborn port killer for macOS
    if command -v lsof >/dev/null; then
        lsof -ti tcp:$port | xargs kill -9 2>/dev/null || true
    fi
    
    sleep 1
}

# Kill stubborn ports
echo "🧹 Cleaning up ports..."
kill_port $MAIN_PORT
kill_port $CHATBOT_PORT

# Wait a bit more for ports to be fully released
sleep 2

# Start chatbot backend
echo "🤖 Starting chatbot backend on port $CHATBOT_PORT..."
cd chatbot
npm install --silent 2>/dev/null || echo "Dependencies already installed"

# Set chatbot port via environment variable
export PORT=$CHATBOT_PORT

# Start chatbot in background
npm start &
CHATBOT_PID=$!
echo "✅ Chatbot backend started (PID: $CHATBOT_PID)"

# Wait for chatbot to fully start
echo "⏳ Waiting for chatbot to initialize..."
sleep 5

# Go back to main directory
cd ..

# Start main site HTTP server
echo "🌐 Starting main URA site on port $MAIN_PORT..."
python3 -m http.server $MAIN_PORT &
MAIN_PID=$!
echo "✅ Main site started (PID: $MAIN_PID)"

# Wait for main site to start
sleep 3

# Update chatbot modal to point to correct chatbot URL
echo "🔧 Configuring chatbot integration..."

# Create the iframe content for the modal
IFRAME_CONTENT="<iframe src=\"http://localhost:$CHATBOT_PORT/rpm-chatbot.html\" width=\"100%\" height=\"100%\" frameborder=\"0\" style=\"border-radius: 16px;\"></iframe>"

# Use sed to inject the iframe into the modal (macOS compatible)
sed -i '' "s|<div class=\"chatbot-modal-content\">.*</div>|<div class=\"chatbot-modal-content\">$IFRAME_CONTENT</div>|" index.html

echo "✅ Chatbot integration configured"

# Open browser to main site
echo "🌍 Opening browser..."
sleep 2
open "http://localhost:$MAIN_PORT"

echo ""
echo "🎉 URA Website is now running!"
echo "📍 Main Site: http://localhost:$MAIN_PORT"
echo "🤖 Chatbot Backend: http://localhost:$CHATBOT_PORT"
echo ""
echo "📋 Process IDs:"
echo "   Main Site: $MAIN_PID"
echo "   Chatbot: $CHATBOT_PID"
echo ""
echo "🛑 To stop all services:"
echo "   kill $MAIN_PID $CHATBOT_PID"
echo "   or use: pkill -f \"python3 -m http.server $MAIN_PORT\""
echo "   and: pkill -f \"node.*server.js\""
echo ""
echo "✨ Enjoy your URA website with AI chatbot!"

# Keep script running to show status
wait