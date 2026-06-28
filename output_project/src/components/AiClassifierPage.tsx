import React, { useState, useRef } from "react";
import { Sparkles, Upload, Image as ImageIcon, AlertTriangle, CheckCircle, ShieldAlert, Cpu, HelpCircle, Loader2 } from "lucide-react";
import { Issue, UserSession } from "../types.ts";

interface AiClassifierPageProps {
  issues: Issue[];
  session?: UserSession | null;
}

export default function AiClassifierPage({ issues, session }: AiClassifierPageProps) {
  // Filter issues by role scope
  const filteredIssues = React.useMemo(() => {
    if (session?.role === "collector" && session.assignedDistrict) {
      return issues.filter(
        (i) => i.district?.toLowerCase() === session.assignedDistrict!.toLowerCase()
      );
    }
    if (session?.role === "mla" && session.assignedConstituency) {
      return issues.filter(
        (i) => i.constituency?.toLowerCase() === session.assignedConstituency!.toLowerCase()
      );
    }
    return issues;
  }, [issues, session]);
  // Mode selection: "custom" or "existing"
  const [mode, setMode] = useState<"existing" | "custom">("existing");
  const [selectedIssueId, setSelectedIssueId] = useState<string>("");

  // Custom issue state
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [customFilePreview, setCustomFilePreview] = useState<string | null>(null);

  // Loading and result states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    category: string;
    confidence: number;
    isValid: string;
    isValidReason: string;
    summary: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File drop/change handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setCustomFile(file);
        setCustomFilePreview(URL.createObjectURL(file));
      } else {
        setError("Please upload an image file (PNG, JPG, WEBP, GIF).");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("image/")) {
        setCustomFile(file);
        setCustomFilePreview(URL.createObjectURL(file));
      } else {
        setError("Please select an image file (PNG, JPG, WEBP, GIF).");
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removeSelectedFile = () => {
    setCustomFile(null);
    setCustomFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Run Gemini analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const formData = new FormData();

      if (mode === "existing") {
        const issue = issues.find((i) => i._id === selectedIssueId);
        if (!issue) {
          setError("Please select an existing issue to analyze.");
          setAnalyzing(false);
          return;
        }
        formData.append("title", issue.title);
        formData.append("description", issue.description);
        if (issue.imageUrl) {
          formData.append("imageUrl", issue.imageUrl);
        }
      } else {
        if (!customTitle.trim()) {
          setError("Please provide a title for your custom issue.");
          setAnalyzing(false);
          return;
        }
        formData.append("title", customTitle);
        formData.append("description", customDescription);
        if (customFile) {
          formData.append("image", customFile);
        }
      }

      const response = await fetch("/api/issues/analyze", {
        method: "POST",
        body: formData,
      });

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        setAnalysisResult(resJson.data);
      } else {
        setError(resJson.error || "Failed to classify the issue. Please check your Gemini API configuration.");
      }
    } catch (err: any) {
      console.error(err);
      setError("An unexpected error occurred during analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Selected issue details helper
  const selectedIssue = filteredIssues.find((i) => i._id === selectedIssueId);

  return (
    <div className="space-y-8 animate-fadeIn pt-4" id="ai-classifier-page-container">
      
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-[9px] font-black tracking-[0.3em] text-stone-400 uppercase font-sans">
            GEMINI-POWERED ISSUE CLASSIFIER
          </span>
          <h1 className="text-3xl font-black uppercase tracking-tight text-gov-maroon-900 font-display flex items-center gap-2">
            <Cpu className="text-gov-maroon-900 shrink-0" size={28} />
            AI Issue Classifier
          </h1>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-sans">
            Select any reported complaint and run Gemini AI to classify its category and explain the reasoning.
          </p>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center text-[10px] font-sans font-bold px-3 py-1.5 bg-gov-maroon-900 text-white uppercase tracking-wider border border-gov-maroon-800">
            POWERED BY GEMINI 3.5 FLASH
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Input Configuration Panel (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-stone-200 bg-gov-cream-100 p-1">
            <button
              onClick={() => {
                setMode("existing");
                setAnalysisResult(null);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer text-center ${
                mode === "existing"
                  ? "bg-white text-gov-maroon-950 shadow-sm border border-stone-200"
                  : "text-stone-400 hover:text-gov-maroon-900"
              }`}
            >
              Analyze Reported Issue
            </button>
            <button
              onClick={() => {
                setMode("custom");
                setAnalysisResult(null);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer text-center ${
                mode === "custom"
                  ? "bg-white text-gov-maroon-950 shadow-sm border border-stone-200"
                  : "text-stone-400 hover:text-gov-maroon-900"
              }`}
            >
              Custom Testing Playground
            </button>
          </div>

          {/* Form Area */}
          <div className="bg-white border border-stone-200 p-6 space-y-6">
            
            {mode === "existing" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-stone-600 block font-sans">
                    SELECT REPORTED COMPLAINT
                  </label>
                  {session?.role === "collector" && session.assignedDistrict && (
                    <p className="text-[9px] font-sans text-stone-400 uppercase tracking-widest">Scoped to: {session.assignedDistrict} District only</p>
                  )}
                  {session?.role === "mla" && session.assignedConstituency && (
                    <p className="text-[9px] font-sans text-stone-400 uppercase tracking-widest">Scoped to: {session.assignedConstituency} Constituency only</p>
                  )}
                  <select
                    value={selectedIssueId}
                    onChange={(e) => {
                      setSelectedIssueId(e.target.value);
                      setAnalysisResult(null);
                      setError(null);
                    }}
                    className="w-full bg-white border border-stone-300 text-xs px-3 py-2.5 focus:outline-none focus:border-gov-maroon-900 rounded-sm font-sans font-bold"
                  >
                    <option value="">-- CHOOSE A REPORT FROM DATABASE --</option>
                    {filteredIssues.map((issue) => (
                      <option key={issue._id} value={issue._id}>
                        [{issue.district?.toUpperCase() || "TAMIL NADU"}] {issue.title.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedIssue && (
                  <div className="bg-gov-cream-100 border border-stone-200 p-4 space-y-3 font-sans text-[11px] uppercase">
                    <div className="grid grid-cols-2 gap-4 border-b border-gov-cream-200 pb-2">
                      <div>
                        <span className="text-stone-400 text-[9px] block">REPORTER</span>
                        <span className="text-gov-maroon-800 font-bold">{selectedIssue.reporterName || "Anonymous"}</span>
                      </div>
                      <div>
                        <span className="text-stone-400 text-[9px] block">CURRENT STATUS</span>
                        <span className="text-gov-maroon-800 font-bold">{selectedIssue.status || "OPEN"}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[9px] block">REPORTED DESCRIPTION</span>
                      <p className="text-gov-maroon-700 leading-normal font-sans text-xs lowercase first-letter:uppercase">
                        {selectedIssue.description || "No description provided."}
                      </p>
                    </div>

                    {selectedIssue.imageUrl && (
                      <div className="pt-2">
                        <span className="text-stone-400 text-[9px] block mb-1">EVIDENCE PHOTO</span>
                        <div className="relative aspect-video max-h-48 border border-stone-200 overflow-hidden bg-gov-maroon-900">
                          <img
                            src={selectedIssue.imageUrl}
                            alt="Evidence"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-stone-600 block font-sans">
                    ISSUE TITLE
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g., Pothole on Mount Road near Metro Station"
                    className="w-full bg-white border border-stone-300 text-xs px-3 py-2.5 focus:outline-none focus:border-gov-maroon-900 rounded-sm font-sans"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-stone-600 block font-sans">
                    ISSUE DESCRIPTION
                  </label>
                  <textarea
                    rows={4}
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Provide a detailed description of the problem, location details, etc."
                    className="w-full bg-white border border-stone-300 text-xs px-3 py-2.5 focus:outline-none focus:border-gov-maroon-900 rounded-sm font-sans"
                  />
                </div>

                {/* Drag and Drop Upload */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-stone-600 block font-sans">
                    EVIDENCE PHOTO (OPTIONAL)
                  </label>
                  
                  {customFilePreview ? (
                    <div className="relative border border-stone-300 p-2 bg-gov-cream-100">
                      <div className="relative aspect-video max-h-48 overflow-hidden bg-gov-maroon-950 border border-stone-200">
                        <img
                          src={customFilePreview}
                          alt="Test preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[9px] font-sans text-stone-500 uppercase truncate max-w-[250px]">
                          {customFile?.name}
                        </span>
                        <button
                          type="button"
                          onClick={removeSelectedFile}
                          className="text-[9px] font-sans font-black text-red-600 hover:text-gov-maroon-800 uppercase tracking-widest"
                        >
                          Clear Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={triggerFileSelect}
                      className={`border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                        dragActive
                          ? "border-gov-maroon-950 bg-gov-cream-100"
                          : "border-stone-300 hover:border-stone-500 hover:bg-gov-cream-100/50"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <Upload className="mx-auto text-stone-400 mb-2" size={24} />
                      <p className="text-xs font-bold uppercase text-gov-maroon-800 tracking-wider">
                        Drag and drop evidence photo here, or click to browse
                      </p>
                      <p className="text-[9px] text-stone-400 uppercase font-sans tracking-widest mt-1">
                        Supports PNG, JPG, JPEG, WEBP, GIF (Max 25MB)
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-sans uppercase flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Analysis Blocked: </span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={runAnalysis}
              disabled={analyzing || (mode === "existing" && !selectedIssueId)}
              className="w-full bg-gov-maroon-950 text-white font-sans font-black uppercase text-xs py-3.5 tracking-widest hover:bg-gov-maroon-800 active:bg-gov-maroon-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {analyzing ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span>RUNNING GEMINI MULTIMODAL MODEL...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>CLASSIFY & ANALYZE ISSUE WITH AI</span>
                </>
              )}
            </button>

          </div>

        </div>

        {/* Right Output Panel (5 columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white text-gov-maroon-900 p-6 border border-stone-200 space-y-6 min-h-[460px] flex flex-col justify-between rounded-sm shadow-sm">
            
            {/* Header */}
            <div>
              <div className="border-b border-stone-200 pb-3">
                <span className="text-[8px] font-bold tracking-widest text-gov-gold-700 block font-sans">
                  Gemini Decision Cognition Cores
                </span>
                <h3 className="text-xs font-bold uppercase text-gov-maroon-950 font-sans mt-0.5">
                  Analysis Report Output
                </h3>
              </div>

              {/* No result / Loading placeholder */}
              {!analysisResult && !analyzing && (
                <div className="py-20 text-center space-y-3">
                  <Cpu className="mx-auto text-stone-300" size={36} />
                  <p className="text-[10px] text-stone-500 uppercase font-sans tracking-widest leading-relaxed max-w-[220px] mx-auto">
                    Awaiting trigger. Select or design an issue on the left and click Analyze.
                  </p>
                </div>
              )}

              {/* Loading animation */}
              {analyzing && (
                <div className="py-20 text-center space-y-4">
                  <Loader2 className="mx-auto text-gov-gold-600 animate-spin" size={36} />
                  <div className="space-y-1">
                    <p className="text-[10px] text-gov-gold-700 font-sans font-bold tracking-widest uppercase">
                      Cognitive Parsing Running
                    </p>
                    <p className="text-[8px] text-stone-500 font-sans uppercase tracking-wider max-w-[200px] mx-auto leading-normal">
                      Reading evidence material, checking image descriptors, categorizing incident records.
                    </p>
                  </div>
                </div>
              )}

              {/* Success Result Panel */}
              {analysisResult && !analyzing && (
                <div className="space-y-5 pt-4 animate-fadeIn">
                  
                  {/* Category Header Badge */}
                  <div className="bg-gov-cream-200 border border-stone-200 p-4 flex items-center justify-between rounded-sm">
                    <div>
                      <span className="text-[8px] font-sans text-stone-500 uppercase">Classified Sector</span>
                      <h4 className="text-lg font-bold tracking-tight text-gov-maroon-950 font-display mt-0.5">
                        {analysisResult.category}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-sans text-stone-500 uppercase block">Confidence</span>
                      <span className="text-lg font-sans font-black text-gov-gold-700">
                        {analysisResult.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence bar graph */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-gov-cream-200 h-1 rounded-sm overflow-hidden">
                      <div
                        className="bg-gov-gold-600 h-full transition-all duration-700"
                        style={{ width: `${analysisResult.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Validity Evaluation Card */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-sans text-stone-500 uppercase">AI Validity Evaluation</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm ${
                        analysisResult.isValid === "Valid Issue"
                          ? "bg-green-50 text-gov-green-700 border border-gov-green-600"
                          : "bg-red-50 text-red-700 border border-red-600"
                      }`}>
                        {analysisResult.isValid}
                      </span>
                    </div>
                    {analysisResult.isValidReason && (
                      <p className="text-stone-500 text-[11px] font-sans leading-normal italic">
                        &ldquo;{analysisResult.isValidReason}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Summary Card */}
                  <div className="space-y-1.5 border-t border-stone-100 pt-3">
                    <span className="text-[8px] font-sans text-stone-500 uppercase block">AI Issue Summary</span>
                    <div className="bg-gov-cream-200 border-l-4 border-gov-gold-500 p-3 text-xs text-gov-maroon-900 font-sans leading-relaxed rounded-sm normal-case">
                      {analysisResult.summary}
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Footer stamp */}
            <div className="pt-4 border-t border-stone-200 flex justify-between items-center text-[8px] font-sans text-stone-400 uppercase tracking-widest">
              <span>Real-time Cognition Hub</span>
              <span className="text-gov-green-700">Verified Response Secured</span>
            </div>

          </div>

          {/* Core Guidelines Card */}
          <div className="bg-white border border-stone-200 p-5 space-y-3 rounded-sm">
            <span className="text-[8px] font-bold tracking-widest text-stone-400 uppercase block font-sans">
              System Analysis Rules
            </span>
            <p className="text-[10px] text-stone-500 leading-relaxed font-sans">
              Gemini reads raw textual context and attached evidence images to safely direct municipal efforts. Automated routing speeds up response workflows by bypassing manual categorization queues.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
