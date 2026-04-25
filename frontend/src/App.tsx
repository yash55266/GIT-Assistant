import { useState, useMemo } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  GitBranch, FolderGit2, Loader2, Check, X, 
  FileCode2, Sparkles, ChevronRight, TerminalSquare, FlaskConical, GitCommit
} from 'lucide-react';
import { connectRepo, analyzeFile, commitChanges, generateTests, getDependencies } from './api';
import { ReactFlow, Background, Controls, MarkerType, Handle, Position, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- CUSTOM NODE UI ---
// This creates the premium, glassmorphic cards for the graph
const CustomFileNode = ({ data }: any) => {
  const { label, isSelected, isAffected } = data;
  
  return (
    <div className={`relative px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-500 flex items-center min-w-[180px]
      ${isSelected 
        ? 'bg-indigo-950/80 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)] z-50 scale-105' 
        : isAffected 
          ? 'bg-red-950/80 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] z-40 animate-pulse' 
          : 'bg-zinc-900/80 border-zinc-700/50 hover:border-zinc-500 shadow-lg'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-zinc-500 border-none" />
      
      <div className={`p-1.5 rounded-lg mr-3 
        ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : isAffected ? 'bg-red-500/20 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
        <FileCode2 className="h-4 w-4" />
      </div>

      <div className="flex flex-col">
        <span className={`text-xs font-bold tracking-wide truncate max-w-[120px] 
          ${isSelected ? 'text-indigo-100' : isAffected ? 'text-red-100' : 'text-zinc-300'}`}>
          {label}
        </span>
        {isAffected && <span className="text-[9px] text-red-400 uppercase tracking-widest mt-0.5">Affected</span>}
        {isSelected && <span className="text-[9px] text-indigo-400 uppercase tracking-widest mt-0.5">Target</span>}
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-zinc-500 border-none" />
    </div>
  );
};

const nodeTypes = { customFile: CustomFileNode };

function App() {
  // --- STATE ---
  const [repoInput, setRepoInput] = useState('');
  const [repoData, setRepoData] = useState<{ name: string; active_branch: string; files: string[] } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [repoGraph, setRepoGraph] = useState<{nodes: any[], edges: any[]} | null>(null);
  
  // Loading States
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  
  // Results & UI State
  const [analysisResult, setAnalysisResult] = useState<{ summary: string; original_code: string; optimized_code: string } | null>(null);
  const [testResult, setTestResult] = useState<{ summary: string; test_code: string; suggested_filename: string } | null>(null);
  const [activeMode, setActiveMode] = useState<'optimize' | 'test' | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'optimized' | 'diff' | 'test'>('diff');
  
  // Notifications
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- HANDLERS ---
  const handleConnect = async () => {
    if (!repoInput) return;
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const data = await connectRepo(repoInput);
      setRepoData(data);
      
      const graphData = await getDependencies();
      setRepoGraph(graphData);
      
      resetResults();
      setSelectedFile(null);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to connect to repository.");
    } finally {
      setIsConnecting(false);
    }
  };

  const resetResults = () => {
    setAnalysisResult(null);
    setTestResult(null);
    setActiveMode(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    resetResults();
    try {
      const data = await analyzeFile(selectedFile);
      setAnalysisResult(data);
      setActiveMode('optimize');
      setActiveTab('diff');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!selectedFile) return;
    setIsGeneratingTests(true);
    setErrorMsg(null);
    resetResults();
    try {
      const data = await generateTests(selectedFile);
      setTestResult(data);
      setActiveMode('test');
      setActiveTab('test');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Test generation failed.");
    } finally {
      setIsGeneratingTests(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) return;
    setIsCommitting(true);
    setErrorMsg(null);
    try {
      let data;
      if (activeMode === 'optimize' && analysisResult) {
        data = await commitChanges(selectedFile, analysisResult.optimized_code);
      } else if (activeMode === 'test' && testResult) {
        data = await commitChanges(testResult.suggested_filename, testResult.test_code, `AI: Generated unit tests for ${selectedFile}`);
      }
      
      if (data) {
        setSuccessMsg(data.message);
        setTimeout(() => setSuccessMsg(null), 5000);
        resetResults();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Commit failed.");
    } finally {
      setIsCommitting(false);
    }
  };

  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop();
    if (['js', 'jsx'].includes(ext || '')) return 'javascript';
    if (['ts', 'tsx'].includes(ext || '')) return 'typescript';
    if (ext === 'py') return 'python';
    return 'javascript';
  };

  // --- BLAST RADIUS GRAPH LOGIC ---
  const blastRadius = useMemo(() => {
    if (!selectedFile || !repoGraph) return [];
    return repoGraph.edges.filter(e => e.target === selectedFile).map(e => e.source);
  }, [selectedFile, repoGraph]);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!repoGraph) return { flowNodes: [], flowEdges: [] };
    
    const styledNodes = repoGraph.nodes.map((node, i) => {
      const isSelected = node.id === selectedFile;
      const isAffected = blastRadius.includes(node.id);
      
      const cols = 4;
      const spacingX = 280;
      const spacingY = 120;
      
      return {
        id: node.id,
        type: 'customFile',
        position: { x: (i % cols) * spacingX + 50, y: Math.floor(i / cols) * spacingY + 50 },
        data: { 
          label: node.label,
          isSelected,
          isAffected
        },
      };
    });

    const styledEdges = repoGraph.edges.map(edge => ({
      ...edge,
      type: 'smoothstep',
      animated: edge.target === selectedFile,
      style: { 
        stroke: edge.target === selectedFile ? '#ef4444' : '#3f3f46', 
        strokeWidth: edge.target === selectedFile ? 2.5 : 1,
        opacity: edge.target === selectedFile ? 1 : 0.4,
      },
      markerEnd: { 
        type: MarkerType.ArrowClosed, 
        color: edge.target === selectedFile ? '#ef4444' : '#3f3f46',
        width: 15,
        height: 15,
      }
    }));

    return { flowNodes: styledNodes, flowEdges: styledEdges };
  }, [repoGraph, selectedFile, blastRadius]);


  // --- RENDER ---
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-300 font-sans selection:bg-indigo-500/30">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 flex flex-col shadow-2xl backdrop-blur-sm z-20">
        <div className="p-5 flex items-center space-x-3 border-b border-zinc-800/50">
          <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
            <Sparkles className="h-5 w-5 text-indigo-400" />
          </div>
          <h1 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">AI Git Assistant</h1>
        </div>
        
        <div className="p-5 border-b border-zinc-800/50">
          <div className="relative">
            <input 
              type="text" 
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-zinc-600"
              placeholder="https://github.com/..."
            />
            <FolderGit2 className="absolute left-3 top-2.5 h-5 w-5 text-zinc-600" />
          </div>
          <button 
            onClick={handleConnect}
            disabled={isConnecting || !repoInput}
            className="mt-3 w-full bg-zinc-100 hover:bg-white text-zinc-900 font-semibold py-2.5 rounded-lg text-sm transition-all flex justify-center items-center disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ChevronRight className="h-4 w-4 mr-1" />}
            Connect
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {repoData ? (
            <div className="space-y-0.5 mt-2">
              {repoData.files.map((file) => (
                <button 
                  key={file}
                  onClick={() => { setSelectedFile(file); resetResults(); }}
                  className={`w-full text-left cursor-pointer px-3 py-2 text-sm rounded-md flex items-center transition-all duration-200 ${
                    selectedFile === file ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <FileCode2 className={`h-4 w-4 mr-2.5 ${selectedFile === file ? 'text-indigo-400' : 'text-zinc-600'}`} />
                  <span className="truncate" title={file}>{file.split('/').pop()}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-40">
              <GitBranch className="h-12 w-12 mb-3 text-zinc-600" />
              <p className="text-sm">Connect a repo to browse</p>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Top Header */}
        <div className="h-16 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="text-sm font-medium text-zinc-200">
            {selectedFile ? selectedFile.split('/').pop() : <span className="text-zinc-500">No file selected</span>}
          </div>
          
          <div className="flex space-x-3">
            <button 
              onClick={handleGenerateTests}
              disabled={!selectedFile || isGeneratingTests || isAnalyzing}
              className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-200 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 focus:outline-none disabled:opacity-50"
            >
              {isGeneratingTests ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <FlaskConical className="h-4 w-4 mr-2 text-blue-400" />}
              Generate Tests
            </button>
            
            <button 
              onClick={handleAnalyze}
              disabled={!selectedFile || isAnalyzing || isGeneratingTests}
              className="group relative inline-flex items-center justify-center px-5 py-2 text-sm font-medium text-white transition-all duration-200 bg-indigo-600 border border-indigo-500 rounded-lg hover:bg-indigo-500 focus:outline-none disabled:opacity-50 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
            >
              {isAnalyzing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-indigo-200" />}
              Optimize Code
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md">
          {errorMsg && (
             <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center shadow-lg backdrop-blur-md">
               <X className="h-5 w-5 mr-2 cursor-pointer" onClick={() => setErrorMsg(null)} />
               <p className="text-sm">{errorMsg}</p>
             </div>
          )}
          {successMsg && (
             <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg flex items-center shadow-lg backdrop-blur-md">
               <Check className="h-5 w-5 mr-2" />
               <p className="text-sm">{successMsg}</p>
             </div>
          )}
        </div>

        {/* Results Area OR Graph Area */}
        {activeMode ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            {/* Dynamic Summary Card */}
            <div className={`p-6 border-b border-zinc-800 ${activeMode === 'test' ? 'bg-gradient-to-r from-blue-900/20 to-zinc-900/20' : 'bg-gradient-to-r from-indigo-900/20 to-zinc-900/20'}`}>
              <h3 className={`font-semibold flex items-center mb-3 ${activeMode === 'test' ? 'text-blue-300' : 'text-indigo-300'}`}>
                {activeMode === 'test' ? <FlaskConical className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />} 
                {activeMode === 'test' ? 'Testing Strategy & Coverage' : 'AI Optimization Summary'}
              </h3>
              <div className="text-sm text-zinc-300 leading-relaxed bg-black/20 p-4 rounded-lg border border-white/5">
                <p className="whitespace-pre-wrap">{activeMode === 'test' ? testResult?.summary : analysisResult?.summary}</p>
              </div>
            </div>
            
            {/* Tab Navigation (Only for Optimize mode) */}
            {activeMode === 'optimize' && (
              <div className="flex bg-zinc-900/50 px-6 py-3 space-x-2 border-b border-zinc-800">
                {(['diff', 'original', 'optimized'] as const).map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)} 
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 capitalize ${
                      activeTab === tab 
                        ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
                    }`}
                  >
                    {tab} View
                  </button>
                ))}
              </div>
            )}

            {/* Code Views */}
            <div className="flex-1 overflow-auto bg-[#1e1e1e]">
              {activeMode === 'optimize' && activeTab === 'diff' && analysisResult && (
                <div className="text-sm">
                  <ReactDiffViewer 
                    oldValue={analysisResult.original_code} 
                    newValue={analysisResult.optimized_code} 
                    splitView={true} useDarkTheme={true}
                    styles={{ variables: { dark: { diffViewerBackground: '#1e1e1e' } } }}
                  />
                </div>
              )}
              {activeMode === 'optimize' && activeTab === 'original' && analysisResult && (
                <SyntaxHighlighter language={getLanguage(selectedFile!)} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.5rem', background: '#1e1e1e', minHeight: '100%' }} showLineNumbers>
                  {analysisResult.original_code}
                </SyntaxHighlighter>
              )}
              {activeMode === 'optimize' && activeTab === 'optimized' && analysisResult && (
                <SyntaxHighlighter language={getLanguage(selectedFile!)} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.5rem', background: '#1e1e1e', minHeight: '100%' }} showLineNumbers>
                  {analysisResult.optimized_code}
                </SyntaxHighlighter>
              )}
              
              {activeMode === 'test' && testResult && (
                <SyntaxHighlighter language={getLanguage(testResult.suggested_filename)} style={vscDarkPlus} customStyle={{ margin: 0, padding: '1.5rem', background: '#1e1e1e', minHeight: '100%' }} showLineNumbers>
                  {testResult.test_code}
                </SyntaxHighlighter>
              )}
            </div>

            {/* Floating Action Panel */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex justify-between items-center z-10">
              <span className="text-xs text-zinc-500">
                {activeMode === 'test' ? `Will be saved as: ${testResult?.suggested_filename}` : 'Review changes carefully before committing.'}
              </span>
              <div className="flex space-x-3">
                <button 
                  onClick={resetResults}
                  className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 flex items-center text-sm font-medium"
                >
                  <X className="h-4 w-4 mr-2" /> Discard
                </button>
                <button 
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 shadow-lg flex items-center text-sm font-medium disabled:opacity-50"
                >
                  {isCommitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
                  {activeMode === 'test' ? 'Commit Test File' : 'Approve & Commit'}
                </button>
              </div>
            </div>
            
          </div>
        ) : (
          /* INTERACTIVE GRAPH DASHBOARD */
          <div className="flex-1 flex flex-col bg-[#09090b] relative">
            {repoGraph ? (
               <>
                 {/* Floating Info Overlay */}
                 <div className="absolute top-4 left-6 z-10 bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-2xl max-w-sm pointer-events-auto">
                   <h2 className="text-sm font-bold text-zinc-200 mb-1 flex items-center">
                     <GitCommit className="h-4 w-4 mr-2 text-indigo-400" /> Codebase Architecture
                   </h2>
                   <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
                     Interactive dependency map. Select a file from the sidebar to visualize its <b>Blast Radius</b>.
                   </p>
                   
                   {/* Scrollable Blast Radius Detail Box */}
                   {selectedFile && blastRadius.length > 0 && (
                     <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg mt-2 max-h-32 overflow-y-auto custom-scrollbar">
                       <p className="text-xs text-red-400 font-semibold mb-1">⚠️ Blast Radius Detected</p>
                       <p className="text-[10px] text-red-300/80 mb-1.5">
                         Refactoring <span className="text-white font-medium">{selectedFile.split('/').pop()}</span> may affect {blastRadius.length} dependent files:
                       </p>
                       <ul className="text-[10px] text-red-200/90 list-disc list-inside space-y-0.5 pl-1">
                         {blastRadius.map((affectedFile) => (
                           <li key={affectedFile} className="truncate" title={affectedFile}>
                             {affectedFile.split('/').pop()}
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>
                 
                 <ReactFlow 
                   nodes={flowNodes} 
                   edges={flowEdges} 
                   nodeTypes={nodeTypes}
                   fitView 
                   className="bg-[#09090b]"
                   colorMode="dark"
                   style={{ width: '100%', height: '100%' }}
                   minZoom={0.2}
                   maxZoom={2}
                 >
                   <Background color="#27272a" gap={20} size={1.5} variant={BackgroundVariant.Dots} />
                   <Controls className="bg-zinc-900 border-zinc-800 fill-zinc-400 hover:fill-zinc-200" />
                 </ReactFlow>
               </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col opacity-60">
                <div className="h-20 w-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl">
                  <TerminalSquare className="h-8 w-8 text-zinc-700" />
                </div>
                <h2 className="text-lg font-semibold text-zinc-300 mb-2">Connect a repository</h2>
                <p className="max-w-sm text-center text-xs text-zinc-500 leading-relaxed">
                  Connect a codebase to generate an interactive 2D dependency graph.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;