import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api'
});

export const connectRepo = (pathOrUrl: string) => 
  api.post('/repo/connect', { path_or_url: pathOrUrl }).then(res => res.data);

export const analyzeFile = (filePath: string) => 
  api.post('/analyze', { file_path: filePath }).then(res => res.data);

export const generateTests = (filePath: string) => 
  api.post('/generate-tests', { file_path: filePath }).then(res => res.data);

// Notice we updated this to take targetFilePath instead of just filePath
export const commitChanges = (targetFilePath: string, newCode: string, message?: string) => 
  api.post('/repo/commit', { file_path: targetFilePath, optimized_code: newCode, commit_message: message }).then(res => res.data);

// Add this to the bottom of the file
export const getDependencies = () => 
  api.get('/repo/dependencies').then(res => res.data);