import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, RotateCcw, X, Settings, Upload, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;

const ROLES_CONFIG = [
  { key: 'P', name: 'Portieri', count: 3, bg: 'bg-amber-950/20', border: 'border-amber-500/30', badge: 'bg-amber-500 text-slate-950' },
  { key: 'D', name: 'Difensori', count: 8, bg: 'bg-emerald-950/20', border: 'border-emerald-500/30', badge: 'bg-emerald-500 text-slate-950' },
  { key: 'C', name: 'Centrocampisti', count: 8, bg: 'bg-blue-950/20', border: 'border-blue-500/30', badge: 'bg-blue-500 text-white' },
  { key: 'A', name: 'Attaccanti', count: 6, bg: 'bg-rose-950/20', border: 'border-rose-500/30', badge: 'bg-rose-500 text-white' }
];

export default function App() {
  const [totalBudget, setTotalBudget] = useState(() => {
    return parseInt(localStorage.getItem('fanta_custom_budget_final') || '500', 10);
  });

  const [hasDefMod, setHasDefMod] = useState(() => {
    return localStorage.getItem('fanta_custom_mod_def_final') !== 'false';
  });

  const [hasTeamMod, setHasTeamMod] = useState(() => {
    return localStorage.getItem('fanta_custom_mod_team_final') !== 'false';
  });

  const [teamCount, setTeamCount] = useState(() => {
    return parseInt(localStorage.getItem('fanta_custom_teams_count_final') || '8', 10);
  });

  const [teamNames, setTeamNames] = useState(() => {
    const saved = localStorage.getItem('fanta_custom_team_names_final');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return Array.from({ length: 14 }, (_, i) => `Squadra ${i + 1}`);
  });

  const [teamsData, setTeamsData] = useState(() => {
    const saved = localStorage.getItem('fanta_custom_teams_data_final');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    const initial = {};
    for (let i = 0; i < 14; i++) {
      initial[i] = {
        P: Array(3).fill({ name: '', price: '' }),
        D: Array(8).fill({ name: '', price: '' }),
        C: Array(8).fill({ name: '', price: '' }),
        A: Array(6).fill({ name: '', price: '' })
      };
    }
    return initial;
  });

  const [customPlayersDb, setCustomPlayersDb] = useState(() => {
    const saved = localStorage.getItem('fanta_custom_players_db_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) { }
    }
    return [];
  });

  const [history, setHistory] = useState([]);
  const [quickName, setQuickName] = useState('');
  const [quickRole, setQuickRole] = useState('P');
  const [quickTeamIndex, setQuickTeamIndex] = useState(0);
  const [quickPrice, setQuickPrice] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const suggestionRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('fanta_custom_budget_final', totalBudget.toString());
    localStorage.setItem('fanta_custom_mod_def_final', hasDefMod.toString());
    localStorage.setItem('fanta_custom_mod_team_final', hasTeamMod.toString());
    localStorage.setItem('fanta_custom_teams_count_final', teamCount.toString());
    localStorage.setItem('fanta_custom_team_names_final', JSON.stringify(teamNames));
    localStorage.setItem('fanta_custom_teams_data_final', JSON.stringify(teamsData));
    localStorage.setItem('fanta_custom_players_db_v4', JSON.stringify(customPlayersDb));
  }, [totalBudget, hasDefMod, hasTeamMod, teamCount, teamNames, teamsData, customPlayersDb]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveHistoryState = (nextData) => {
    setHistory(prev => [...prev.slice(-20), JSON.stringify(teamsData)]);
    setTeamsData(nextData);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, prev.length - 1));
    setTeamsData(JSON.parse(lastState));
  };

  const handleNameSearchChange = (value) => {
    setQuickName(value);
    if (value.trim().length >= 1 && customPlayersDb.length > 0) {
      const q = value.toLowerCase();
      const filtered = customPlayersDb.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.team && p.team.toLowerCase().includes(q))
      ).slice(0, 10);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectPlayer = (player) => {
    const display = player.team ? `${player.name} (${player.team})` : player.name;
    setQuickName(display);
    if (['P', 'D', 'C', 'A'].includes(player.role)) {
      setQuickRole(player.role);
    }
    setShowSuggestions(false);
  };

  const handleCellChange = (teamIdx, role, index, field, value) => {
    const updatedTeam = { ...teamsData[teamIdx] };
    const updatedRoleList = [...updatedTeam[role]];
    let parsedVal = value;
    if (field === 'price') {
      parsedVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    }
    updatedRoleList[index] = { ...updatedRoleList[index], [field]: parsedVal };
    updatedTeam[role] = updatedRoleList;
    saveHistoryState({ ...teamsData, [teamIdx]: updatedTeam });
  };

  const handleClearSlot = (teamIdx, role, index) => {
    const updatedTeam = { ...teamsData[teamIdx] };
    const updatedRoleList = [...updatedTeam[role]];
    updatedRoleList[index] = { name: '', price: '' };
    updatedTeam[role] = updatedRoleList;
    saveHistoryState({ ...teamsData, [teamIdx]: updatedTeam });
  };

  const handleQuickAssign = (e) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    const teamSlots = teamsData[quickTeamIndex][quickRole];
    const emptyIndex = teamSlots.findIndex(s => !s.name || s.name.trim() === '');

    if (emptyIndex === -1) {
      alert(`Attenzione: ${teamNames[quickTeamIndex]} ha già completato i posti per il ruolo ${quickRole}!`);
      return;
    }

    const finalPrice = quickPrice === '' ? 1 : Math.max(1, parseInt(quickPrice, 10) || 1);
    const updatedTeam = { ...teamsData[quickTeamIndex] };
    const updatedRole = [...updatedTeam[quickRole]];
    updatedRole[emptyIndex] = {
      name: quickName.trim(),
      price: finalPrice
    };
    updatedTeam[quickRole] = updatedRole;

    saveHistoryState({ ...teamsData, [quickTeamIndex]: updatedTeam });
    setQuickName('');
    setQuickPrice('');
    setShowSuggestions(false);
  };

  const getTeamStats = (teamIdx) => {
    const team = teamsData[teamIdx];
    let totalSpent = 0;
    const roleTotals = { P: 0, D: 0, C: 0, A: 0 };
    const roleCounts = { P: 0, D: 0, C: 0, A: 0 };

    ['P', 'D', 'C', 'A'].forEach(role => {
      team[role].forEach(slot => {
        const val = typeof slot.price === 'number' ? slot.price : parseInt(slot.price, 10) || 0;
        roleTotals[role] += val;
        totalSpent += val;
        if (slot.name && slot.name.trim() !== '') {
          roleCounts[role] += 1;
        }
      });
    });

    const remainingBudget = totalBudget - totalSpent;
    const totalPlayers = roleCounts.P + roleCounts.D + roleCounts.C + roleCounts.A;
    return { totalSpent, remainingBudget, roleTotals, roleCounts, totalPlayers };
  };

  const getRemainingColorClass = (remaining) => {
    const thresholdGreen = Math.round(totalBudget * 0.7);
    const thresholdYellow = Math.round(totalBudget * 0.4);

    if (remaining >= thresholdGreen) {
      return 'bg-emerald-600 text-white border-emerald-400 font-black';
    } else if (remaining >= thresholdYellow) {
      return 'bg-amber-500 text-slate-950 border-amber-300 font-black';
    } else {
      return 'bg-rose-600 text-white border-rose-400 font-black';
    }
  };

  const cleanPlayerName = (name) => {
    return name.replace(/[^\w\sÀ-ÿ.'-]/gi, '').replace(/\s+/g, ' ').trim();
  };

  const parseAndAddPlayers = (rawPlayers) => {
    const validRoles = ['P', 'D', 'C', 'A'];
    const cleanList = rawPlayers
      .map(p => {
        const role = (p.role || '').toUpperCase().charAt(0);
        const name = cleanPlayerName(p.name || '');
        const team = cleanPlayerName(p.team || '');
        return { name, role, team };
      })
      .filter(p => validRoles.includes(p.role) && p.name.length >= 2);

    // Rimuovi duplicati
    const uniqueMap = new Map();
    cleanList.forEach(p => {
      const key = `${p.name}_${p.role}_${p.team}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, p);
    });

    const finalPlayers = Array.from(uniqueMap.values());

    if (finalPlayers.length > 0) {
      setCustomPlayersDb(finalPlayers);
      setUploadStatus(`✅ Caricati con successo ${finalPlayers.length} calciatori nel listone!`);
    } else {
      setUploadStatus('❌ Nessun dato valido estratto dal file.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('⏳ Lettura del file in corso...');

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const parsed = [];

          rows.forEach(r => {
            if (Array.isArray(r) && r.length >= 2) {
              const strRow = r.map(c => String(c).trim());
              const roleIdx = strRow.findIndex(c => ['P', 'D', 'C', 'A', 'POR', 'DIF', 'CEN', 'ATT'].includes(c.toUpperCase()));
              if (roleIdx !== -1) {
                const role = strRow[roleIdx].charAt(0).toUpperCase();
                const name = strRow.find((c, idx) => idx !== roleIdx && isNaN(c) && c.length > 1 && !['P', 'D', 'C', 'A'].includes(c.toUpperCase()));
                const team = strRow.find((c, idx) => idx !== roleIdx && isNaN(c) && c !== name && c.length > 1) || '';
                if (name) parsed.push({ name, role, team });
              }
            }
          });
          parseAndAddPlayers(parsed);
        } catch (err) {
          setUploadStatus('❌ Errore durante la lettura del file Excel.');
        }
      };
      reader.readAsBinaryString(file);
    } else if (ext === 'csv') {
      Papa.parse(file, {
        complete: (results) => {
          const parsed = [];
          results.data.forEach(r => {
            if (Array.isArray(r) && r.length >= 2) {
              const strRow = r.map(c => String(c).trim());
              const roleIdx = strRow.findIndex(c => ['P', 'D', 'C', 'A', 'POR', 'DIF', 'CEN', 'ATT'].includes(c.toUpperCase()));
              if (roleIdx !== -1) {
                const role = strRow[roleIdx].charAt(0).toUpperCase();
                const name = strRow.find((c, idx) => idx !== roleIdx && isNaN(c) && c.length > 1);
                const team = strRow.find((c, idx) => idx !== roleIdx && isNaN(c) && c !== name && c.length > 1) || '';
                if (name) parsed.push({ name, role, team });
              }
            }
          });
          parseAndAddPlayers(parsed);
        }
      });
    } else if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const typedarray = new Uint8Array(reader.result);
          const loadingTask = pdfjsLib.getDocument({
            data: typedarray,
            nativeImageDecoderSupport: 'none',
            disableFontFace: true
          });
          const pdf = await loadingTask.promise;
          const parsed = [];

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const items = textContent.items.map(it => it.str.trim()).filter(Boolean);

            for (let j = 0; j < items.length; j++) {
              const item = items[j];
              const roleMatch = item.match(/^([PDCA])(\(.*\))?$/i);
              if (roleMatch) {
                const role = roleMatch[1].toUpperCase();
                const name = items[j + 1];
                const team = items[j + 2];

                if (name && team && isNaN(name) && isNaN(team) && !name.startsWith('#') && !team.startsWith('#')) {
                  parsed.push({ role, name, team });
                }
              }
            }
          }

          if (parsed.length > 0) {
            parseAndAddPlayers(parsed);
          } else {
            setUploadStatus('❌ Impossibile leggere il layout di questo PDF.');
          }
        } catch (err) {
          setUploadStatus('❌ Errore durante la decodifica del PDF.');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePasteImport = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split('\n');
    const parsed = [];

    lines.forEach(line => {
      const parts = line.split(/[\t,;|]/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        let role = parts.find(p => ['P', 'D', 'C', 'A', 'POR', 'DIF', 'CEN', 'ATT'].includes(p.toUpperCase()));
        let name = parts.find(p => p !== role && isNaN(p) && p.length > 1);
        let team = parts.find(p => p !== role && p !== name && isNaN(p)) || '';

        if (name && role) {
          parsed.push({
            name,
            role: role.charAt(0).toUpperCase(),
            team
          });
        }
      }
    });

    parseAndAddPlayers(parsed);
    setPasteText('');
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex-shrink-0 z-30 shadow-md">
        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-black tracking-wide text-white">ASTA MANAGER 2026-2027</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800 px-3 py-1 rounded border border-slate-700">
              <span>Budget: <strong className="text-emerald-400">{totalBudget}</strong></span>
              <span>•</span>
              <span>Mod. Difesa: {hasDefMod ? '✅' : '❌'}</span>
              <span>•</span>
              <span>Mod. Squadra: {hasTeamMod ? '✅' : '❌'}</span>
              <span>•</span>
              <span>Squadre: <strong className="text-emerald-400">{teamCount}</strong></span>
              <span>•</span>
              <span>Listone: <strong className="text-indigo-400">{customPlayersDb.length} giocatori</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Annulla azione
              </button>
            )}

            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow transition"
            >
              <Upload className="w-3.5 h-3.5" /> Listone Calciatori
            </button>

            <button
              onClick={() => setIsConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white rounded shadow transition"
            >
              <Settings className="w-3.5 h-3.5" /> Regole & Squadre
            </button>
          </div>
        </div>
      </header>

      {/* Barra Assegnazione Rapida */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2 flex-shrink-0 z-20 shadow">
        <form onSubmit={handleQuickAssign} className="w-full flex flex-wrap items-center gap-3 relative">
          <span className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Assegna:
          </span>

          <div className="flex-1 min-w-[260px] relative" ref={suggestionRef}>
            <input
              type="text"
              required
              placeholder={customPlayersDb.length > 0 ? "Digita nome giocatore dal listone..." : "Carica prima il listone o scrivi il nome..."}
              value={quickName}
              onChange={e => handleNameSearchChange(e.target.value)}
              onFocus={() => quickName.length >= 1 && setShowSuggestions(true)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-3 py-1.5 text-base text-white placeholder-slate-500 outline-none"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
                {suggestions.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPlayer(p)}
                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-black ${
                        p.role === 'P' ? 'bg-amber-500 text-black' :
                        p.role === 'D' ? 'bg-emerald-500 text-black' :
                        p.role === 'C' ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {p.role}
                      </span>
                      <span className="font-bold text-white text-sm">{p.name}</span>
                    </div>
                    {p.team && (
                      <span className="text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {p.team}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <select
            value={quickRole}
            onChange={e => setQuickRole(e.target.value)}
            className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-sm font-bold text-white outline-none cursor-pointer"
          >
            <option value="P">P (Portiere)</option>
            <option value="D">D (Difensore)</option>
            <option value="C">C (Centrocampista)</option>
            <option value="A">A (Attaccante)</option>
          </select>

          <select
            value={quickTeamIndex}
            onChange={e => setQuickTeamIndex(parseInt(e.target.value, 10))}
            className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-sm font-bold text-emerald-300 outline-none cursor-pointer"
          >
            {Array.from({ length: teamCount }).map((_, idx) => (
              <option key={idx} value={idx}>{teamNames[idx] || `Squadra ${idx + 1}`}</option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            max={totalBudget}
            required
            placeholder="Prezzo"
            value={quickPrice}
            onChange={e => setQuickPrice(e.target.value)}
            className="w-24 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-base font-bold text-amber-300 text-center outline-none"
          />

          <button
            type="submit"
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded shadow transition"
          >
            Invia alla Squadra
          </button>
        </form>
      </div>

      {/* Tabellone Squadre */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-3 w-full">
        <div className="flex gap-3 w-max min-w-full h-full">
          {Array.from({ length: teamCount }).map((_, teamIdx) => {
            const stats = getTeamStats(teamIdx);

            return (
              <div key={teamIdx} className="w-[280px] flex-shrink-0 flex flex-col bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow h-full">
                {/* Intestazione Squadra */}
                <div className="flex-shrink-0 bg-slate-800 p-2 border-b border-slate-700 text-center shadow">
                  <input
                    type="text"
                    value={teamNames[teamIdx]}
                    onChange={(e) => {
                      const updated = [...teamNames];
                      updated[teamIdx] = e.target.value;
                      setTeamNames(updated);
                    }}
                    placeholder={`Squadra ${teamIdx + 1}`}
                    className="w-full bg-transparent text-center font-extrabold text-base text-emerald-300 focus:bg-slate-950 rounded px-1.5 py-0.5 outline-none border border-transparent focus:border-emerald-500 transition"
                  />
                  <div className="flex justify-between items-center text-xs mt-1 px-1 text-slate-300">
                    <span>Budget:</span>
                    <span className="font-black text-white bg-slate-700 px-2 py-0.5 rounded">{totalBudget}</span>
                  </div>
                </div>

                {/* Zona Giocatori */}
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                  {ROLES_CONFIG.map(roleConf => {
                    const roleKey = roleConf.key;
                    const slots = teamsData[teamIdx][roleKey];
                    const spentRole = stats.roleTotals[roleKey];
                    const percentRole = ((spentRole / totalBudget) * 100).toFixed(1);

                    return (
                      <div key={roleKey} className={`rounded border ${roleConf.border} ${roleConf.bg} p-1.5`}>
                        <div className="flex justify-between items-center mb-1.5 px-1">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${roleConf.badge}`}>
                            {roleConf.name} ({slots.filter(s => s.name.trim()).length}/{roleConf.count})
                          </span>
                          <span className="text-xs text-slate-300 font-bold">
                            Spesi: <strong className="text-amber-300">{spentRole}</strong>
                          </span>
                        </div>

                        {/* Righe Giocatori */}
                        <div className="space-y-1">
                          {slots.map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder={`${roleKey}${idx + 1}`}
                                value={slot.name}
                                onChange={e => handleCellChange(teamIdx, roleKey, idx, 'name', e.target.value)}
                                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded px-2 py-1 text-[15px] font-semibold text-white focus:outline-none whitespace-nowrap overflow-x-auto"
                              />
                              <input
                                type="number"
                                min="0"
                                max={totalBudget}
                                placeholder="€"
                                value={slot.price}
                                onChange={e => handleCellChange(teamIdx, roleKey, idx, 'price', e.target.value)}
                                className="w-14 flex-shrink-0 bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded px-1 py-1 text-[15px] font-black text-center text-amber-400 focus:outline-none"
                              />
                              {slot.name ? (
                                <button
                                  type="button"
                                  onClick={() => handleClearSlot(teamIdx, roleKey, idx)}
                                  title="Cancella slot"
                                  className="p-1 flex-shrink-0 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded transition"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="w-[22px] flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Percentuale Spesa Reparto */}
                        <div className="mt-1.5 pt-1 border-t border-slate-800 flex justify-between items-center px-1 text-xs">
                          <span className="text-slate-400 font-medium">% spesa:</span>
                          <span className="font-bold text-xs text-emerald-300 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {percentRole}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Crediti Residui */}
                <div className="flex-shrink-0 p-2 border-t border-slate-800 bg-slate-950 flex flex-col gap-1.5 shadow-lg">
                  <div className="flex justify-between items-center text-xs text-slate-300 px-1">
                    <span>Spesi: <strong className="text-white text-sm">{stats.totalSpent}</strong></span>
                    <span>Slot: <strong className="text-white text-sm">{stats.totalPlayers}/25</strong></span>
                  </div>

                  <div className={`py-1.5 px-2 rounded border text-center flex flex-col items-center justify-center transition-all ${getRemainingColorClass(stats.remainingBudget)}`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold">Crediti Residui</span>
                    <span className="text-2xl font-black tracking-tight">{stats.remainingBudget}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Finestra Modale Impostazioni */}
      {isConfigOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" /> Configura Regole Lega
              </h3>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Budget Totale Iniziale Crediti:</label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="50"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(Math.max(100, parseInt(e.target.value, 10) || 500))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-amber-300 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Numero di Squadre Partecipanti:</label>
                <select
                  value={teamCount}
                  onChange={(e) => setTeamCount(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {[4, 6, 8, 10, 12, 14].map(num => (
                    <option key={num} value={num}>{num} Squadre</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Modificatore Difesa:</label>
                  <select
                    value={hasDefMod ? "SI" : "NO"}
                    onChange={(e) => setHasDefMod(e.target.value === "SI")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-emerald-400 outline-none"
                  >
                    <option value="SI">Attivo ✅</option>
                    <option value="NO">Disattivo ❌</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Modificatore Squadra:</label>
                  <select
                    value={hasTeamMod ? "SI" : "NO"}
                    onChange={(e) => setHasTeamMod(e.target.value === "SI")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-emerald-400 outline-none"
                  >
                    <option value="SI">Attivo ✅</option>
                    <option value="NO">Disattivo ❌</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition shadow"
              >
                Salva Regole
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finestra Modale Listone */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-400" /> Carica Listone Calciatori ({customPlayersDb.length} in memoria)
              </h3>
              <button onClick={() => setIsUploadOpen(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Seleziona File Listone (.pdf, .xlsx, .csv):</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  onChange={handleFileUpload}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <label className="block text-xs font-bold text-slate-300 mb-1">Oppure Incolla Righe di Testo (Nome, Ruolo, Squadra):</label>
                <textarea
                  rows="3"
                  placeholder="Es: Lautaro Martinez, A, Inter&#10;Dimarco, D, Inter"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handlePasteImport}
                  className="mt-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded text-slate-200 transition"
                >
                  Importa Testo
                </button>
              </div>

              {uploadStatus && (
                <div className="p-2.5 rounded bg-slate-950 border border-indigo-500/40 text-xs text-indigo-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {uploadStatus}
                </div>
              )}

              <button
                onClick={() => setIsUploadOpen(false)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition shadow"
              >
                Chiudi Finestra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
