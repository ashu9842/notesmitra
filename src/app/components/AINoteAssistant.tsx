import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, BookOpen, List, Zap, ChevronDown, ChevronUp, MessageSquare, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Note } from "../App";
import { notesAPI } from "../../utils/api-mern";
import { formatClientErrorMessage } from "../../utils/errorMessages";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AISummary {
  summary: string;
  keyTopics: string[];
  quickRevision: string[];
}

interface AINoteAssistantProps {
  note: Note;
}

export function AINoteAssistant({ note }: AINoteAssistantProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "chat">("summary");

  // ── Summary state ─────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(true);
  const [showTopics, setShowTopics] = useState(true);
  const [showRevision, setShowRevision] = useState(true);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-load summary when panel first opens
  useEffect(() => {
    if (!summary && !isSummaryLoading) {
      loadSummary();
    }
  }, [note.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSummary = async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await notesAPI.getAISummary(note.id);
      setSummary({
        summary: data.summary || "",
        keyTopics: data.keyTopics || [],
        quickRevision: data.quickRevision || [],
      });
    } catch (err: any) {
      setSummaryError(formatClientErrorMessage(err, "Failed to generate AI summary"));
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const question = inputValue.trim();
    if (!question || isChatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: question, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsChatLoading(true);
    setChatError(null);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const data = await notesAPI.aiChat(note.id, question, history);
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: data.answer || "Sorry, I could not generate a response.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setChatError(formatClientErrorMessage(err, "AI chat failed"));
      // Remove the optimistic user message on failure
      setMessages(prev => prev.slice(0, -1));
      setInputValue(question);
    } finally {
      setIsChatLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatError(null);
    inputRef.current?.focus();
  };

  // Suggested starter questions
  const starterQuestions = [
    "Explain the most important concept in simple terms",
    "What are the key formulas or definitions I must remember?",
    "Give me a 5-question practice quiz with answers",
    "What topics are most likely to appear in an exam?",
  ];

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-md">
      {/* Header */}
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-purple-900">AI Study Assistant</p>
            <p className="text-xs font-normal text-muted-foreground truncate max-w-[260px]">{note.title}</p>
          </div>
          <Badge className="ml-auto bg-purple-100 text-purple-700 border-purple-300 text-xs">Powered by Gemini</Badge>
        </CardTitle>

        {/* Tab switcher */}
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant={activeTab === "summary" ? "default" : "outline"}
            className={activeTab === "summary" ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-300 text-purple-700 hover:bg-purple-100"}
            onClick={() => setActiveTab("summary")}
          >
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Smart Summary
          </Button>
          <Button
            size="sm"
            variant={activeTab === "chat" ? "default" : "outline"}
            className={activeTab === "chat" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "border-indigo-300 text-indigo-700 hover:bg-indigo-100"}
            onClick={() => setActiveTab("chat")}
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
            Ask AI
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            {isSummaryLoading && (
              <div className="flex flex-col items-center gap-3 py-10 text-purple-600">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Gemini is reading your notes…</p>
                <p className="text-xs text-muted-foreground">This may take 10–20 seconds</p>
              </div>
            )}

            {summaryError && !isSummaryLoading && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center space-y-3">
                <p className="text-sm text-red-600">{summaryError}</p>
                <Button size="sm" variant="outline" onClick={loadSummary} className="border-red-300 text-red-600 hover:bg-red-50">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Try Again
                </Button>
              </div>
            )}

            {summary && !isSummaryLoading && (
              <div className="space-y-3">
                {/* Quick Revision */}
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-yellow-100 transition-colors"
                    onClick={() => setShowRevision(v => !v)}
                  >
                    <div className="flex items-center gap-2 font-semibold text-yellow-800 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                      Quick Revision Points
                      <Badge className="bg-yellow-200 text-yellow-800 border-0 text-xs ml-1">{summary.quickRevision.length}</Badge>
                    </div>
                    {showRevision ? <ChevronUp className="w-4 h-4 text-yellow-600" /> : <ChevronDown className="w-4 h-4 text-yellow-600" />}
                  </button>
                  {showRevision && (
                    <ul className="px-4 pb-3 space-y-1.5">
                      {summary.quickRevision.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-yellow-900">
                          <span className="mt-0.5 w-5 h-5 rounded-full bg-yellow-300 text-yellow-900 text-xs font-bold flex-shrink-0 flex items-center justify-center">{i + 1}</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Key Topics */}
                <div className="rounded-xl bg-blue-50 border border-blue-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-blue-100 transition-colors"
                    onClick={() => setShowTopics(v => !v)}
                  >
                    <div className="flex items-center gap-2 font-semibold text-blue-800 text-sm">
                      <List className="w-4 h-4 text-blue-500" />
                      Key Topics Covered
                    </div>
                    {showTopics ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                  </button>
                  {showTopics && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {summary.keyTopics.map((topic, i) => (
                        <Badge key={i} className="bg-blue-100 text-blue-700 border-blue-300 text-xs font-medium">{topic}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Summary */}
                <div className="rounded-xl bg-white border border-purple-200 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-purple-50 transition-colors"
                    onClick={() => setShowSummary(v => !v)}
                  >
                    <div className="flex items-center gap-2 font-semibold text-purple-800 text-sm">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      Full AI Summary
                    </div>
                    {showSummary ? <ChevronUp className="w-4 h-4 text-purple-600" /> : <ChevronDown className="w-4 h-4 text-purple-600" />}
                  </button>
                  {showSummary && (
                    <div className="px-4 pb-4 prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                      {summary.summary}
                    </div>
                  )}
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  AI-generated · verify important facts before exam
                  <button onClick={loadSummary} className="ml-2 text-purple-600 underline hover:no-underline">Regenerate</button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === "chat" && (
          <div className="flex flex-col gap-3">
            {/* Chat messages */}
            <div className="h-72 overflow-y-auto rounded-xl bg-white border border-indigo-100 p-3 space-y-3 scroll-smooth">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-muted-foreground">
                  <Bot className="w-10 h-10 text-indigo-300" />
                  <div>
                    <p className="text-sm font-medium text-indigo-700">Ask anything about this note</p>
                    <p className="text-xs mt-1">I've read the entire note and I'm ready to help you study!</p>
                  </div>
                  {/* Starter question chips */}
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    {starterQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setInputValue(q); inputRef.current?.focus(); }}
                        className="text-left text-xs bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {chatError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{chatError}</p>
            )}

            {/* Input area */}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this note… (Enter to send)"
                rows={2}
                disabled={isChatLoading}
                className="flex-1 resize-none rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 placeholder:text-gray-400"
              />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="icon"
                  disabled={!inputValue.trim() || isChatLoading}
                  onClick={handleSendMessage}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
                {messages.length > 0 && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={clearChat}
                    title="Clear chat"
                    className="w-10 h-10 rounded-xl border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              AI answers are based on note content · always verify critical facts
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
