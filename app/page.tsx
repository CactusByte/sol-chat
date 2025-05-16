"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Message {
  id: string
  sender: string
  content: string
  timestamp: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [username, setUsername] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isUsernameSet, setIsUsernameSet] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Connect to WebSocket
  useEffect(() => {
    if (!isUsernameSet) return

    const connectWebSocket = () => {
      try {
        // Store connection state to prevent multiple reconnection attempts
        if (
          socketRef.current &&
          (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)
        ) {
          return
        }

        console.log("Attempting to connect to WebSocket server...")
        setConnectionError(null)

        // Create new WebSocket connection
        const ws = new WebSocket("ws://trenches-chat-09c74c336a53.herokuapp.com/")
        socketRef.current = ws

        ws.onopen = () => {
          setIsConnected(true)
          setConnectionError(null)
          console.log("Connected to WebSocket server")
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            setMessages((prev) => [...prev, message])
          } catch (error) {
            console.error("Failed to parse message:", error)
          }
        }

        ws.onclose = (event) => {
          setIsConnected(false)
          console.log("Disconnected from WebSocket server:", event.code, event.reason)

          // Only try to reconnect if we haven't completely given up
          if (!socketRef.current?.permanentlyClosed) {
            setTimeout(connectWebSocket, 5000)
          }
        }

        ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          setIsConnected(false)

          // Check if we've already tried to connect multiple times
          if (socketRef.current?.reconnectAttempts >= 2) {
            setConnectionError("Unable to connect to the chat server at trenches-chat-09c74c336a53.herokuapp.com/. Using demo mode instead.")
            enableDemoMode()
          } else {
            setConnectionError("Failed to connect to the chat server at trenches-chat-09c74c336a53.herokuapp.com/. Retrying...")
            // Increment reconnect attempts
            socketRef.current.reconnectAttempts = (socketRef.current.reconnectAttempts || 0) + 1
          }
        }

        // Add custom properties to track connection state
        ws.reconnectAttempts = 0
        ws.permanentlyClosed = false
      } catch (error) {
        console.error("WebSocket connection error:", error)
        setConnectionError("Failed to connect to the chat server at trenches-chat-09c74c336a53.herokuapp.com/.")

        // If we've completely failed to connect, enable demo mode
        setTimeout(() => {
          if (!isConnected) {
            enableDemoMode()
          }
        }, 3000)
      }
    }

    // Function to enable a demo mode when server connection fails
    const enableDemoMode = () => {
      if (socketRef.current) {
        socketRef.current.permanentlyClosed = true
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close()
        }
      }

      // Create a fake WebSocket for demo purposes
      const fakeSocket = {} as WebSocket
      fakeSocket.send = (data) => {
        try {
          const message = JSON.parse(data)
          // Simulate receiving the message back
          setTimeout(() => {
            setMessages((prev) => [...prev, message])
          }, 500)

          // Occasionally simulate receiving messages from others
          if (Math.random() > 0.7) {
            setTimeout(
              () => {
                const demoUsers = ["System", "DemoUser", "Bot", "ChatGPT"]
                const demoMessages = [
                  "Welcome to the chat!",
                  "How's everyone doing today?",
                  "This is a demo mode since the server is not available.",
                  "Try running your WebSocket server at localhost:8000 to use real chat.",
                  "Hello there!",
                  "Nice weather today, isn't it?",
                  "Anyone working on something interesting?",
                ]

                const demoMessage = {
                  id: Date.now().toString() + Math.random(),
                  sender: demoUsers[Math.floor(Math.random() * demoUsers.length)],
                  content: demoMessages[Math.floor(Math.random() * demoMessages.length)],
                  timestamp: new Date().toISOString(),
                }

                setMessages((prev) => [...prev, demoMessage])
              },
              2000 + Math.random() * 3000,
            )
          }
        } catch (error) {
          console.error("Error in demo mode:", error)
        }
      }

      // Set the fake socket and mark as connected
      socketRef.current = fakeSocket as any
      setIsConnected(true)
      setConnectionError("Connected to demo mode (server unavailable)")

      // Add welcome message for demo mode
      setMessages([
        {
          id: "welcome-msg",
          sender: "System",
          content:
            "Connected to DEMO MODE. Your WebSocket server at trenches-chat-09c74c336a53.herokuapp.com/ could not be reached. Messages are simulated.",
          timestamp: new Date().toISOString(),
        },
      ])
    }

    connectWebSocket()

    return () => {
      if (socketRef.current && !socketRef.current.permanentlyClosed) {
        // Mark as permanently closed to prevent reconnection attempts
        socketRef.current.permanentlyClosed = true

        // Only close if it's a real WebSocket and it's open
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close()
        }
      }
    }
  }, [isUsernameSet, isConnected])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !isConnected) return

    const newMessage = {
      id: Date.now().toString(),
      sender: username,
      content: inputMessage,
      timestamp: new Date().toISOString(),
    }

    try {
      // Add message to local state immediately
      setMessages((prev) => [...prev, newMessage])
      setInputMessage("")

      if (socketRef.current) {
        // For real WebSocket connections
        if (socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(newMessage))
        }
        // For our demo mode implementation
        else if (socketRef.current.send && typeof socketRef.current.send === "function") {
          socketRef.current.send(JSON.stringify(newMessage))
        } else {
          setConnectionError("Connection issue. Try refreshing the page.")
        }
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setConnectionError("Failed to send message. Connection may be unstable.")
    }
  }

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      setIsUsernameSet(true)
    }
  }

  if (!isUsernameSet) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4">
        <div className="w-full max-w-md rounded border border-green-500 bg-black p-6">
          <h1 className="mb-6 font-mono text-2xl font-bold text-green-500">Trenches Chat</h1>
          <form onSubmit={handleSetUsername} className="flex flex-col gap-4">
            <div className="font-mono text-green-500">Enter your username:</div>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-green-500 bg-black font-mono text-green-500"
              maxLength={15}
              required
            />
            <Button type="submit" className="bg-green-500 font-mono text-black hover:bg-green-600">
              CONNECT
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-black p-4">
      <header className="mb-4 flex items-center justify-between border-b border-green-500 pb-2">
        <h1 className="font-mono text-xl font-bold text-green-500">Trenches Chat</h1>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
          <span className="font-mono text-sm text-green-500">{isConnected ? "CONNECTED" : "DISCONNECTED"}</span>
        </div>
      </header>

      {connectionError && (
        <Alert className={`mb-4 border-${connectionError.includes("demo") ? "yellow" : "red"}-500 bg-black`}>
          <AlertDescription className={`font-mono text-${connectionError.includes("demo") ? "yellow" : "red"}-500`}>
            {connectionError}
            {connectionError.includes("server") && !connectionError.includes("demo") && (
              <div className="mt-2">Make sure your WebSocket server is running at trenches-chat-09c74c336a53.herokuapp.com/</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex-1 overflow-y-auto rounded border border-green-500 bg-black p-4">
        <div className="flex flex-col gap-2">
          {messages.length === 0 ? (
            <div className="font-mono text-green-500 opacity-50">No messages yet. Be the first to say hello!</div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="font-mono text-green-500">
                <span className="font-bold">{msg.sender}: </span>
                <span>{msg.content}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <Input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          className="border-green-500 bg-black font-mono text-green-500"
          disabled={!isConnected}
        />
        <Button type="submit" disabled={!isConnected} className="bg-green-500 font-mono text-black hover:bg-green-600">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
