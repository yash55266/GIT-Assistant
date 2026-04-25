import { useState, useMemo } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  GitBranch, FolderGit2, Loader2, Check, X, 
  FileCode2, Sparkles, ChevronRight, TerminalSquare, FlaskConical, GitCommit, Search
} from 'lucide-react';
import { connectRepo, analyzeFile, commitChanges, generateTests, getDependencies } from './api';
import axios from 'axios';
import { ReactFlow, Background, Controls, MarkerType, Handle, Position, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// --- 1. CUSTOM NODE UI (Upgraded with Tooltips & Better Width) ---
const CustomFileNode = ({ data }: any) => {
  const { label, isSelected, isAffected, health, cc_score, fullPath } = data;
  
  const healthConfig = {
    healthy: { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400', shadow: 'shadow-[0_0_10px_rgba(16,185,129,0.2)]' },
    moderate: { border: 'border-yellow-500/50', bg: 'bg-yellow-500/10', text: 'text-yellow-400', shadow: 'shadow-[0_0_10px_rgba(245,158,11,0.2)]' },
    debt: { border: 'border-orange-600/50', bg: 'bg-orange-600/10', text: 'text-orange-400', shadow: 'shadow-[0_0_10px_rgba(234,88,12,0.2)]' }
  };
  
  const currentHealth = healthConfig[health as keyof typeof healthConfig] || healthConfig.healthy;

  return (
    <div 
      title={fullPath}
      className={`relative px-4 py-3 rounded-xl border backdrop-blur-md transition-all duration-500 flex items-center min-w-[260px]
      ${isSelected 
        ? 'bg-indigo-950/80 border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.6)] z-50 scale-105' 
        : isAffected 
          ? 'bg-red-950/80 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] z-40 animate-pulse' 
          : `${currentHealth.bg} ${currentHealth.border} ${currentHealth.shadow}`
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-zinc-600 border-none" />
      
      <div className={`p-1.5 rounded-lg mr-3 
        ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : isAffected ? 'bg-red-500/20 text-red-300' : 'bg-zinc-800 text-zinc-400'}`}>
        <FileCode2 className="h-4 w-4" />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex justify-between items-center w-full gap-2">
           <span className={`text-xs font-bold tracking-wide truncate flex-1 
            ${isSelected ? 'text-indigo-100' : isAffected ? 'text-red-100' : 'text-zinc-200'}`}>
            {label}
          </span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-mono whitespace-nowrap ${currentHealth.border} ${currentHealth.text}`}>
            CC: {cc_score || 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
           {isAffected && <span className="text-[8px] text-red-400 font-bold uppercase tracking-tighter">Blast Radius</span>}
           {isSelected && <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tighter">Focus</span>}
           {!isAffected && !isSelected && <span className="text-[8px] text-zinc-500 truncate opacity-60 italic">{fullPath.split('/').slice(0,-1).join('/')}</span>}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-zinc-600 border-none" />
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
  
  // Search & Operation States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{file: string, explanation: string, snippet: string} | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  
  const [analysisResult, setAnalysisResult] = useState<{ summary: string; original_code: string; optimized_code: string } | null>(null);
  const [testResult, setTestResult] = useState<{ summary: string; test_code: string; suggested_filename: string } | null>(null);
  const [activeMode, setActiveMode] = useState<'optimize' | 'test' | null>(null);
  const [activeTab, setActiveTab] = useState<'original' | 'optimized' | 'diff' | 'test'>('diff');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- HANDLERS ---
  const handleConnect = async () => {
    if (!repoInput) return;
    setIsConnecting(true); setErrorMsg(null);
    try {
      const data = await connectRepo(repoInput);
      setRepoData(data);
      const graphData = await getDependencies();
      setRepoGraph(graphData);
      resetResults(); setSelectedFile(null);
    } catch (err: any) {
      setErrorMsg("Connection failed. Check if backend is running.");
    } finally { setIsConnecting(false); }
  };

  const handleIntentSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true); setSearchResult(null);
    try {
      const response = await axios.post('http://localhost:8000/api/intent-search', { query: searchQuery });
      const text = response.data.result;
      const file = text.match(/FILE: (.*)/)?.[1]?.trim();
      const explanation = text.match(/EXPLANATION: (.*)/)?.[1];
      const snippet = text.match(/CODE_SNIPPET: ([\s\S]*)/)?.[1];

      if (file) {
        setSelectedFile(file);
        setSearchResult({ file, explanation: explanation || '', snippet: snippet || '' });
      }
    } catch (err) { setErrorMsg("Could not locate that logic in the codebase."); }
    finally { setIsSearching(false); }
  };

  const resetResults = () => {
    setAnalysisResult(null); setTestResult(null); setActiveMode(null); setSearchResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true); resetResults();
    try {
      const data = await analyzeFile(selectedFile);
      setAnalysisResult(data); setActiveMode('optimize'); setActiveTab('diff');
    } catch (err) { setErrorMsg("Analysis failed."); }
    finally { setIsAnalyzing(false); }
  };

  const handleGenerateTests = async () => {
    if (!selectedFile) return;
    setIsGeneratingTests(true); resetResults();
    try {
      const data = await generateTests(selectedFile);
      setTestResult(data); setActiveMode('test'); setActiveTab('test');
    } catch (err) { setErrorMsg("Test generation failed."); }
    finally { setIsGeneratingTests(false); }
  };

  const handleCommit = async () => {
    if (!selectedFile) return;
    setIsCommitting(true);
    try {
      let data;
      if (activeMode === 'optimize' && analysisResult) {
        data = await commitChanges(selectedFile, analysisResult.optimized_code);
      } else if (activeMode === 'test' && testResult) {
        data = await commitChanges(testResult.suggested_filename, testResult.test_code, `AI: Generated tests for ${selectedFile}`);
      }
      if (data) { setSuccessMsg(data.message); resetResults(); }
    } catch (err) { setErrorMsg("Commit failed."); }
    finally { setIsCommitting(false); }
  };

  // --- MEMOS & GRAPH LOGIC ---
  const blastRadius = useMemo(() => {
    if (!selectedFile || !repoGraph) return [];
    return repoGraph.edges.filter(e => e.target === selectedFile).map(e => e.source);
  }, [selectedFile, repoGraph]);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (!repoGraph) return { flowNodes: [], flowEdges: [] };
    const styledNodes = repoGraph.nodes.map((node, i) => {
      const isSelected = node.id === selectedFile;
      const isAffected = blastRadius.includes(node.id);
      return {
        id: node.id, type: 'customFile',
        position: { x: (i % 3) * 320 + 50, y: Math.floor(i / 3) * 160 + 50 },
        data: { 
            label: node.label, 
            isSelected, 
            isAffected, 
            health: node.health, 
            cc_score: node.cc_score,
            fullPath: node.id 
        },
      };
    });
    const styledEdges = repoGraph.edges.map(edge => ({
      ...edge, type: 'smoothstep', animated: edge.target === selectedFile,
      style: { stroke: edge.target === selectedFile ? '#ef4444' : '#3f3f46', strokeWidth: edge.target === selectedFile ? 2.5 : 1, opacity: edge.target === selectedFile ? 1 : 0.4 },
      markerEnd: { type: MarkerType.ArrowClosed, color: edge.target === selectedFile ? '#ef4444' : '#3f3f46' }
    }));
    return { flowNodes: styledNodes, flowEdges: styledEdges };
  }, [repoGraph, selectedFile, blastRadius]);

  const getLanguage = (f: string) => f.endsWith('.py') ? 'python' : f.endsWith('.ts') || f.endsWith('.tsx') ? 'typescript' : 'javascript';

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-zinc-300 font-sans selection:bg-indigo-500/30">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-zinc-900/50 border-r border-zinc-800 flex flex-col shadow-2xl backdrop-blur-sm z-20">
        <div className="p-5 flex items-center space-x-3 border-b border-zinc-800/50">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          <h1 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">AI Git Assistant</h1>
        </div>
        
        <div className="p-5 border-b border-zinc-800/50">
          <input 
            type="text" value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
            placeholder="GitHub URL..."
          />
          <button onClick={handleConnect} disabled={isConnecting || !repoInput} className="mt-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-all flex justify-center items-center">
            {isConnecting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <ChevronRight className="h-3 w-3 mr-1" />} Connect
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {repoData?.files.map((file) => (
            <button 
              key={file} title={file} onClick={() => { setSelectedFile(file); resetResults(); }}
              className={`w-full text-left px-3 py-2 text-xs rounded-md flex items-center mb-0.5 transition-all ${
                selectedFile === file ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20' : 'text-zinc-400 hover:bg-zinc-800/50 border border-transparent'
              }`}
            >
              <FileCode2 className={`h-3.5 w-3.5 mr-2.5 ${selectedFile === file ? 'text-indigo-400' : 'text-zinc-600'}`} />
              <span className="truncate flex-1">{file.split('/').pop()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative">
        
        {/* HEADER with SEMANTIC SEARCH */}
        <div className="h-16 border-b border-zinc-800 bg-zinc-900/30 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIntentSearch()}
                placeholder="Where is the login logic?..."
                className="w-full bg-zinc-950/50 border border-zinc-800 rounded-full py-2 pl-10 pr-4 text-xs focus:ring-1 focus:ring-indigo-500/50 transition-all outline-none"
              />
              {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-indigo-400" />}
            </div>
          </div>
          
          <div className="flex space-x-3 ml-4">
            <button onClick={handleGenerateTests} disabled={!selectedFile || isGeneratingTests} className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-700 flex items-center">
              <FlaskConical className="h-3.5 w-3.5 mr-2 text-blue-400" /> Tests
            </button>
            <button onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing} className="px-4 py-2 bg-indigo-600 border border-indigo-500 rounded-lg text-xs font-bold text-white hover:bg-indigo-500 shadow-lg flex items-center">
              <Sparkles className="h-3.5 w-3.5 mr-2" /> Optimize
            </button>
          </div>
        </div>

        {/* NOTIFICATIONS */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md">
          {errorMsg && <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-xs shadow-xl backdrop-blur-md flex items-center"><X className="h-4 w-4 mr-2 cursor-pointer" onClick={() => setErrorMsg(null)} />{errorMsg}</div>}
          {successMsg && <div className="bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-xs shadow-xl backdrop-blur-md flex items-center"><Check className="h-4 w-4 mr-2" />{successMsg}</div>}
        </div>

        {/* MAIN DISPLAY */}
        {activeMode ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
            <div className={`p-6 border-b border-zinc-800 ${activeMode === 'test' ? 'bg-blue-900/10' : 'bg-indigo-900/10'}`}>
              <h3 className={`font-bold text-xs uppercase tracking-widest flex items-center mb-3 ${activeMode === 'test' ? 'text-blue-400' : 'text-indigo-400'}`}>
                {activeMode === 'test' ? <FlaskConical className="h-3.5 w-3.5 mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-2" />} Logic Insights
              </h3>
              <p className="text-xs text-zinc-300 bg-black/20 p-4 rounded-lg border border-white/5 whitespace-pre-wrap leading-relaxed">
                {activeMode === 'test' ? testResult?.summary : analysisResult?.summary}
              </p>
            </div>
            
            <div className="flex bg-zinc-900/50 px-6 py-2 border-b border-zinc-800 space-x-2">
              {(['diff', 'original', 'optimized'] as const).map((tab) => (activeMode === 'optimize' || tab === 'original') && (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1 text-[10px] font-bold rounded-full transition-all uppercase ${activeTab === tab ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-auto bg-[#1e1e1e] custom-scrollbar">
              {activeMode === 'optimize' && activeTab === 'diff' && <ReactDiffViewer oldValue={analysisResult?.original_code} newValue={analysisResult?.optimized_code} splitView={true} useDarkTheme={true} />}
              {(activeTab === 'original' || activeTab === 'optimized' || activeMode === 'test') && (
                <SyntaxHighlighter language={getLanguage(selectedFile!)} style={vscDarkPlus} customStyle={{ margin: 0, padding: '2rem', background: 'transparent', fontSize: '13px' }} showLineNumbers>
                  {activeTab === 'optimized' ? analysisResult?.optimized_code : activeMode === 'test' ? testResult?.test_code : analysisResult?.original_code}
                </SyntaxHighlighter>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur-md flex justify-between items-center">
              <span className="text-[10px] text-zinc-500 italic truncate max-w-sm" title={activeMode === 'test' ? testResult?.suggested_filename : selectedFile || ''}>
                {activeMode === 'test' ? `File: ${testResult?.suggested_filename}` : `Editing: ${selectedFile}`}
              </span>
              <div className="flex space-x-3">
                <button onClick={resetResults} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white">Discard</button>
                <button onClick={handleCommit} disabled={isCommitting} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center">
                  {isCommitting ? <Loader2 className="animate-spin h-3 w-3 mr-2" /> : <GitBranch className="h-3 w-3 mr-2" />} Commit
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ARCHITECTURE MAP VIEW */
          <div className="flex-1 flex flex-col bg-[#09090b] relative">
            {repoGraph ? (
               <>
                 <div className="absolute top-4 left-6 z-10 bg-zinc-900/80 backdrop-blur-md p-4 rounded-xl border border-zinc-800 shadow-2xl max-w-sm pointer-events-auto">
                   <h2 className="text-xs font-bold text-zinc-200 mb-2 flex items-center uppercase tracking-tighter">
                     <GitCommit className="h-4 w-4 mr-2 text-indigo-400" /> Codebase Dependencies
                   </h2>
                   
                   {selectedFile && blastRadius.length > 0 && (
                     <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg mt-2 max-h-40 overflow-y-auto custom-scrollbar">
                       <p className="text-[10px] text-red-400 font-bold mb-1.5 flex items-center">
                         <X className="h-3 w-3 mr-1" /> Blast Radius Detected ({blastRadius.length})
                       </p>
                       <ul className="text-[10px] text-red-200/70 list-disc list-inside space-y-1 pl-1">
                         {blastRadius.map(f => (
                           <li key={f} className="truncate cursor-help" title={f}>
                             {f.split('/').pop()}
                             <span className="text-[8px] opacity-40 ml-1 italic">({f.split('/').slice(0, -1).join('/')})</span>
                           </li>
                         ))}
                       </ul>
                     </div>
                   )}
                 </div>

                 {searchResult && (
                    <div className="absolute top-4 right-6 z-30 w-80 bg-zinc-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-3 border-b border-white/5 flex justify-between items-center bg-indigo-500/10">
                        <h3 className="text-[10px] font-bold text-indigo-300 uppercase">Logic Found</h3>
                        <X className="h-3.5 w-3.5 text-zinc-500 cursor-pointer hover:text-white" onClick={() => setSearchResult(null)} />
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] text-zinc-400 mb-3 leading-relaxed">{searchResult.explanation}</p>
                        <div className="bg-black/30 p-2 rounded border border-white/5 mb-3">
                           <code className="text-[9px] text-indigo-200 break-all">{searchResult.snippet}</code>
                        </div>
                        <button onClick={handleAnalyze} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg shadow-lg">
                          Modify This Logic
                        </button>
                      </div>
                    </div>
                 )}

                 <div className="absolute bottom-6 left-6 z-10 bg-zinc-900/80 backdrop-blur-md p-3 rounded-lg border border-zinc-800 text-[9px] space-y-1.5 shadow-xl">
                   <p className="font-bold text-zinc-500 uppercase tracking-widest mb-1">Health Index</p>
                   <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_#10b981]" /> Healthy Code</div>
                   <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-yellow-500 mr-2 shadow-[0_0_8px_#f59e0b]" /> Moderate Debt</div>
                   <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-orange-600 mr-2 shadow-[0_0_8px_#ea580c]" /> Refactor Critical</div>
                 </div>
                 
                 <ReactFlow 
                    nodes={flowNodes} 
                    edges={flowEdges} 
                    nodeTypes={nodeTypes} 
                    fitView 
                    colorMode="dark" 
                    style={{ width: '100%', height: '100%' }}
                    minZoom={0.1}
                 >
                   <Background color="#27272a" gap={25} size={1} variant={BackgroundVariant.Dots} />
                   <Controls className="bg-zinc-800 border-zinc-700 fill-zinc-400" />
                 </ReactFlow>
               </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col opacity-40">
                <TerminalSquare className="h-12 w-12 text-zinc-700 mb-4" />
                <h2 className="text-sm font-bold uppercase tracking-widest">Connect Repository</h2>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;