import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Member } from '../../types';
import {
  X,
  Upload,
  UserPlus,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f59e0b', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16'
];

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { members, addMember, requireAuth } = useFinance();
  const [inputText, setInputText] = useState('');
  const [defaultRole, setDefaultRole] = useState('Core Member');
  const [parsedMembers, setParsedMembers] = useState<Array<{ name: string; phone: string; isDuplicate: boolean }>>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    if (!inputText.trim()) return;

    const lines = inputText.split('\n');
    const results: Array<{ name: string; phone: string; isDuplicate: boolean }> = [];

    const existingNames = new Set(members.map((m) => m.name.toLowerCase().trim()));

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().startsWith('name,phone') || trimmed.toLowerCase().startsWith('name\tphone')) {
        return;
      }

      // Check delimiters: comma, tab, semicolon, or dash
      let parts: string[] = [];
      if (trimmed.includes(',')) {
        parts = trimmed.split(',');
      } else if (trimmed.includes('\t')) {
        parts = trimmed.split('\t');
      } else if (trimmed.includes(';')) {
        parts = trimmed.split(';');
      } else if (trimmed.includes('-')) {
        parts = trimmed.split('-');
      } else {
        parts = [trimmed];
      }

      const name = (parts[0] || '').trim();
      let phone = (parts[1] || '').trim();

      // Format phone number nicely
      if (phone) {
        const cleanDigits = phone.replace(/[^0-9+]/g, '');
        if (cleanDigits.length === 10) {
          phone = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;
        } else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
          phone = `+91 ${cleanDigits.slice(2, 7)} ${cleanDigits.slice(7)}`;
        } else {
          phone = cleanDigits;
        }
      }

      if (name) {
        const isDuplicate = existingNames.has(name.toLowerCase());
        results.push({ name, phone, isDuplicate });
      }
    });

    setParsedMembers(results);
    setHasParsed(true);
  };

  const handleImport = () => {
    requireAuth(() => {
      let count = 0;
      parsedMembers.forEach((item, idx) => {
        if (!item.isDuplicate && item.name) {
          const randomColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          addMember({
            name: item.name,
            phone: item.phone,
            role: defaultRole,
            avatarColor: randomColor,
          });
          count++;
        }
      });

      setImportSuccessCount(count);
      setTimeout(() => {
        onClose();
        setInputText('');
        setParsedMembers([]);
        setHasParsed(false);
        setImportSuccessCount(null);
      }, 1400);
    });
  };

  const sampleTemplate = `Appu, 9846573639
Fayis, 9633636576
Jamsheed, 8606170704
Nisam, 7510981877`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <Upload className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Batch Import Members
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Add multiple Tm ISHAL members at once via CSV or text
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4.5 flex-1 bg-[#0B1120]">
          {importSuccessCount !== null ? (
            <div className="p-8 text-center space-y-3 bg-emerald-950/40 border border-emerald-800/80 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-lg font-bold text-white">
                Imported {importSuccessCount} Members Successfully!
              </h4>
              <p className="text-xs text-emerald-300 font-medium">
                Roster has been updated and synchronized.
              </p>
            </div>
          ) : !hasParsed ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Paste Member List (Name, Phone Number)
                </label>
                <textarea
                  rows={8}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={sampleTemplate}
                  className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
                  <span>Supported format: `Name, Phone` or just names line-by-line</span>
                  <button
                    type="button"
                    onClick={() => setInputText(sampleTemplate)}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Load Sample
                  </button>
                </div>
              </div>

              {/* Default Role Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Default Role for Imported Members
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Core Member', 'Coordinator'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDefaultRole(r)}
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        defaultRole === r
                          ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                          : 'bg-[#111A2E] text-slate-400 border-slate-800 hover:bg-[#15223C]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleParse}
                disabled={!inputText.trim()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
                <span>Preview & Parse Members</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  Parsed Members ({parsedMembers.length} detected)
                </span>
                <button
                  onClick={() => setHasParsed(false)}
                  className="text-xs text-blue-400 hover:underline font-bold"
                >
                  Edit Input Text
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-800 rounded-2xl p-2 bg-[#111A2E]">
                {parsedMembers.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      item.isDuplicate
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                        : 'bg-[#0D1527] border-slate-800/80 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-slate-500 font-mono-num font-bold text-[11px] w-5">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{item.name}</span>
                        {item.phone && (
                          <span className="text-slate-400 font-mono-num text-[11px] block">
                            {item.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {item.isDuplicate ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-900/60 text-rose-300 border border-rose-700">
                          Already in Roster
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          Ready to Add
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHasParsed(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={parsedMembers.filter((m) => !m.isDuplicate).length === 0}
                  className="flex-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    Add {parsedMembers.filter((m) => !m.isDuplicate).length} New Members
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
