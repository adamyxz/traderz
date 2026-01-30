'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin-sidebar';
import AdminHeader from '@/components/admin-header';
import { Search, Play, Edit, Trash2, Code2, X } from 'lucide-react';
import { Reader, ReaderParameter } from '@/lib/readers/types';

export default function ReadersAdminPage() {
  const [readers, setReaders] = useState<(Reader & { parameters?: ReaderParameter[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingReader, setEditingReader] = useState<
    (Reader & { parameters?: ReaderParameter[] }) | null
  >(null);
  const [testingReader, setTestingReader] = useState<
    (Reader & { parameters?: ReaderParameter[] }) | null
  >(null);
  const [deletingReaderId, setDeletingReaderId] = useState<number | null>(null);

  useEffect(() => {
    fetchReaders();
    // 首次加载时自动同步readers
    syncReadersSilently();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncReadersSilently = async () => {
    try {
      const response = await fetch('/api/readers/sync', { method: 'POST' });
      if (response.ok) {
        await fetchReaders();
      }
    } catch (error) {
      console.error('Error syncing readers:', error);
    }
  };

  const fetchReaders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/readers');
      if (!response.ok) throw new Error('Failed to fetch readers');
      const data = await response.json();
      setReaders(data);
    } catch (error) {
      console.error('Error fetching readers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/readers/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete reader');
      setReaders(readers.filter((r) => r.id !== id));
      setDeletingReaderId(null);
    } catch (error) {
      console.error('Error deleting reader:', error);
      alert('删除失败');
    }
  };

  const filteredReaders = readers.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
        <AdminSidebar />
        <div className="ml-20">
          <AdminHeader />
          <main className="flex items-center justify-center p-8">
            <div className="text-white">Loading...</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1E1E1E' }}>
      <AdminSidebar />
      <div className="ml-20">
        <AdminHeader />

        <main className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Readers</h1>
          </div>

          {/* Search */}
          <div className="mb-6 rounded-2xl p-6" style={{ backgroundColor: '#2D2D2D' }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search reader name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-gray-700/50 py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Readers Grid */}
          {filteredReaders.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#2D2D2D' }}>
              <div className="mb-4 rounded-full bg-gray-700 p-4 w-fit mx-auto">
                <Code2 className="h-12 w-12 text-gray-500" />
              </div>
              <p className="text-lg text-gray-400">No readers found</p>
              <p className="mt-2 text-sm text-gray-500">
                Add reader directories to the /readers folder to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredReaders.map((reader) => (
                <div
                  key={reader.id}
                  className="group relative overflow-hidden rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-5 transition-all hover:border-gray-600 hover:shadow-xl"
                >
                  {/* Header */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-white truncate">{reader.name}</h3>
                    <p className="mt-1 text-sm text-gray-400 line-clamp-2 h-10">
                      {reader.description || 'No description'}
                    </p>
                  </div>

                  {/* Script Path */}
                  <div className="mb-3 rounded-lg bg-gray-900/50 px-3 py-2">
                    <code className="text-xs text-gray-500 truncate block">
                      {reader.scriptPath}
                    </code>
                  </div>

                  {/* Parameters */}
                  {reader.parameters && reader.parameters.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {reader.parameters.slice(0, 3).map((param) => (
                          <span
                            key={param.id}
                            className="rounded bg-gray-700/50 px-2 py-1 text-xs text-gray-400"
                          >
                            {param.displayName}
                          </span>
                        ))}
                        {reader.parameters.length > 3 && (
                          <span className="rounded bg-gray-700/50 px-2 py-1 text-xs text-gray-400">
                            +{reader.parameters.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 border-t border-gray-700 pt-3">
                    <button
                      onClick={() => setTestingReader(reader)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                    >
                      <Play className="h-3 w-3" />
                      Test
                    </button>
                    <button
                      onClick={() => setEditingReader(reader)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600/20 px-3 py-2 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-600/30"
                    >
                      <Edit className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingReaderId(reader.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-600/30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deletingReaderId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div
                className="w-full max-w-md rounded-2xl p-8"
                style={{ backgroundColor: '#2D2D2D' }}
              >
                <h3 className="text-2xl font-bold text-white mb-4">Confirm Deletion</h3>
                <p className="text-gray-300 mb-6">
                  Are you sure you want to delete reader &ldquo;
                  {readers.find((r) => r.id === deletingReaderId)?.name}&rdquo;? This action cannot
                  be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeletingReaderId(null)}
                    className="rounded-lg px-6 py-3 text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deletingReaderId)}
                    className="rounded-lg bg-red-500 px-6 py-3 text-white hover:bg-red-600 transition-colors"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {editingReader && (
            <EditReaderModal
              reader={editingReader}
              onClose={() => setEditingReader(null)}
              onSuccess={() => {
                setEditingReader(null);
                fetchReaders();
              }}
            />
          )}

          {/* Test Modal */}
          {testingReader && (
            <TestReaderModal reader={testingReader} onClose={() => setTestingReader(null)} />
          )}
        </main>
      </div>
    </div>
  );
}

// Edit Reader Modal
interface EditReaderModalProps {
  reader: Reader & { parameters?: ReaderParameter[] };
  onClose: () => void;
  onSuccess: () => void;
}

function EditReaderModal({ reader, onClose, onSuccess }: EditReaderModalProps) {
  const [formData, setFormData] = useState({
    name: reader.name,
    description: reader.description || '',
    timeout: reader.timeout,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(`/api/readers/${reader.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        setErrors({ submit: error.error || 'Update failed' });
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Error updating reader:', error);
      setErrors({ submit: 'Update failed' });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-8"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Edit Reader</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">修改名称会重命名文件夹和metadata.json</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none"
              placeholder="Reader功能描述..."
            />
            <p className="mt-1 text-xs text-gray-500">修改描述会同步到metadata.json</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Timeout (ms)</label>
            <input
              type="number"
              value={formData.timeout}
              onChange={(e) => setFormData({ ...formData, timeout: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Parameters (Read-only)</h3>
            {reader.parameters && reader.parameters.length > 0 ? (
              <div className="space-y-2">
                {reader.parameters.map((param) => (
                  <div key={param.id} className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-400 font-mono">
                      {param.paramType}
                    </span>
                    <span className="text-gray-300">{param.displayName}</span>
                    <span className="text-gray-500">{param.paramName}</span>
                    {param.isRequired && <span className="text-red-400">*</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No parameters</p>
            )}
          </div>

          {errors.submit && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{errors.submit}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:from-sky-600 hover:to-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Test Reader Modal
interface TestReaderModalProps {
  reader: Reader & { parameters?: ReaderParameter[] };
  onClose: () => void;
}

function TestReaderModal({ reader, onClose }: TestReaderModalProps) {
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ReaderOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleExecute = async () => {
    setExecuting(true);
    setShowResult(true);
    setResult(null);
    setError(null);

    try {
      const parsedParams: Record<string, unknown> = {};
      for (const param of reader.parameters || []) {
        if (parameterValues[param.paramName]) {
          try {
            parsedParams[param.paramName] = JSON.parse(parameterValues[param.paramName]);
          } catch {
            parsedParams[param.paramName] = parameterValues[param.paramName];
          }
        } else if (param.isRequired) {
          throw new Error(`Parameter ${param.displayName} is required`);
        }
      }

      const response = await fetch(`/api/readers/${reader.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: parsedParams,
          triggeredBy: 'manual',
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setParameterValues({});
    setResult(null);
    setError(null);
    setShowResult(false);
  };

  const getParamTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return 'text-blue-400';
      case 'number':
        return 'text-green-400';
      case 'boolean':
        return 'text-yellow-400';
      case 'object':
        return 'text-purple-400';
      case 'array':
        return 'text-pink-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl flex flex-col"
        style={{ backgroundColor: '#2D2D2D' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/20 p-2.5">
              <Play className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Test Reader</h2>
              <p className="text-sm text-gray-400">{reader.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Parameters Section */}
            <div className="rounded-xl border border-gray-700 bg-gray-900/30 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Parameters</h3>
                {reader.parameters && reader.parameters.length > 0 && (
                  <button
                    onClick={handleReset}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              {reader.parameters && reader.parameters.length > 0 ? (
                <div className="space-y-4">
                  {reader.parameters.map((param) => (
                    <div key={param.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-200">
                          {param.displayName}
                        </label>
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded bg-gray-800 ${getParamTypeColor(param.paramType)}`}
                        >
                          {param.paramType}
                        </span>
                        {param.isRequired && <span className="text-red-400 text-xs">*</span>}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={parameterValues[param.paramName] || ''}
                          onChange={(e) =>
                            setParameterValues({
                              ...parameterValues,
                              [param.paramName]: e.target.value,
                            })
                          }
                          placeholder={param.defaultValue || `Enter ${param.displayName}...`}
                          className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        {param.defaultValue && !parameterValues[param.paramName] && (
                          <button
                            onClick={() =>
                              setParameterValues({
                                ...parameterValues,
                                [param.paramName]: String(param.defaultValue),
                              })
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                            title="Use default value"
                          >
                            Use Default
                          </button>
                        )}
                      </div>

                      {param.description && (
                        <p className="text-xs text-gray-500 flex items-start gap-1">
                          <span>ℹ️</span>
                          <span>{param.description}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">This reader has no parameters</p>
                </div>
              )}
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={executing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3.5 font-medium text-white transition-all hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
            >
              {executing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Execute Reader
                </>
              )}
            </button>

            {/* Result Section */}
            {showResult && (
              <div className="rounded-xl border border-gray-700 bg-gray-900/30 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800/50">
                  <h3 className="text-base font-semibold text-white">Execution Result</h3>
                  {result && (
                    <button
                      onClick={() => setShowResult(false)}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      Hide
                    </button>
                  )}
                </div>

                <div className="p-5">
                  {executing && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="h-10 w-10 animate-spin rounded-full border-3 border-emerald-500/30 border-t-emerald-500 mb-4" />
                      <p className="text-gray-400">Executing reader...</p>
                    </div>
                  )}

                  {!executing && result && (
                    <div className="space-y-4">
                      {/* Status Banner */}
                      <div
                        className={`flex items-center gap-3 rounded-lg border p-4 ${
                          result.success
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : 'bg-red-500/10 border-red-500/20'
                        }`}
                      >
                        <div
                          className={`rounded-full p-1.5 ${result.success ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
                        >
                          {result.success ? (
                            <div className="h-2 w-2 rounded-full bg-emerald-400" />
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-red-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p
                            className={`font-medium ${result.success ? 'text-emerald-400' : 'text-red-400'}`}
                          >
                            {result.success ? 'Execution Successful' : 'Execution Failed'}
                          </p>
                          {result.error && (
                            <p className="mt-1 text-sm text-red-300 font-mono">{result.error}</p>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      {result.metadata && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg bg-gray-800/50 p-3">
                            <p className="text-xs text-gray-500 mb-1">Execution Time</p>
                            <p className="text-sm font-semibold text-white">
                              {result.metadata.executionTime}ms
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-800/50 p-3">
                            <p className="text-xs text-gray-500 mb-1">Timestamp</p>
                            <p className="text-sm font-semibold text-white">
                              {new Date(result.metadata.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="rounded-lg bg-gray-800/50 p-3">
                            <p className="text-xs text-gray-500 mb-1">Version</p>
                            <p className="text-sm font-semibold text-white">
                              {result.metadata.version}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Output Data */}
                      {result.data && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-300">Output Data</p>
                            <span className="text-xs text-gray-500">
                              {typeof result.data === 'object'
                                ? `${Object.keys(result.data).length} fields`
                                : 'primitive'}
                            </span>
                          </div>
                          <div className="rounded-lg bg-gray-950 p-4 border border-gray-800 overflow-x-auto">
                            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!executing && error && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-red-500/20 p-1.5">
                          <div className="h-2 w-2 rounded-full bg-red-400" />
                        </div>
                        <div>
                          <p className="font-medium text-red-400">Execution Error</p>
                          <p className="mt-1 text-sm text-red-300 font-mono">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700 bg-gray-900/30">
          <p className="text-xs text-gray-500">
            {reader.parameters?.length || 0} parameter
            {(reader.parameters?.length || 0) !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            {result && !executing && (
              <button
                onClick={handleExecute}
                className="rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
              >
                Re-run
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-sky-600 hover:to-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
