import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, RotateCcw, X, Settings, Users, Copy, Check, Lock, Unlock, ShieldCheck, Share2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { OFFICIAL_PLAYERS_DB } from './playersData';

const ROLES_CONFIG = [
  { key: 'P', name: 'Portieri', count: 3, bg: 'bg-amber-950/20', border: 'border-amber-500/30', badge: 'bg-amber-500 text-slate-950' },
  { key: 'D', name: 'Difensori', count: 8, bg: 'bg-emerald-950/20', border: 'border-emerald-500/30', badge: 'bg-emerald-500 text-slate-950' },
  { key: 'C', name: 'Centrocampisti', count: 8, bg: 'bg-blue-950/20', border: 'border-blue-500/30', badge: 'bg-blue-500 text-white' },
  { key: 'A', name: 'Attaccanti', count: 6, bg: 'bg-rose-950/20', border: 'border-rose-500/30', badge: 'bg-rose-500 text-white' }
];

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myTeamIndex, setMyTeamIndex] = useState(null);
  const [targetTeamIndex, setTargetTeamIndex] = useState(0); // Per selezione squadra Gestore
  const [inLobby, setInLobby] = useState(true);

  // Dati stanza
  const [totalBudget, setTotalBudget] = useState(500);
  const [hasDefMod, setHasDefMod] = useState(true);
  const [hasTeamMod, setHasTeamMod] = useState(true);
  const [teamCount, setTeamCount] = useState(8);
  const [teamNames, setTeamNames] = useState(Array.from({ length: 8 }, (_, i) => `Squadra ${i + 1}`));
  const [lockedRoles, setLockedRoles] = useState({ P: false, D: false, C: false, A: false });
  const [teamsData, setTeamsData] = useState(() => {
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

  const [history, setHistory] = useState([]);
  const [quickName, setQuickName] = useState('');
  const [quickRole, setQuickRole] = useState('P');
  const [quickPrice, setQuickPrice] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  const [joinRoomInput, setJoinRoomInput] = useState('');
  const [newRoomName, setNewRoomName] = useState('');

  const suggestionRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rId = params.get('room');
    if (rId) {
      setJoinRoomInput(rId.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const fetchRoom = async () => {
      const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (data) {
        setTotalBudget(data.budget);
        setHasDefMod(data.has_def_mod);
        setHasTeamMod(data.has_team_mod);
        setTeamCount(data.team_count);
        setTeamNames(data.team_names);
        setTeamsData(data.teams_data);
        setLockedRoles(data.locked_roles || { P: false, D: false, C: false, A: false });
        setHistory(data.history || []);
      }
    };
    fetchRoom();

    const channel = supabase
      .channel(`room_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const updated = payload.new;
        setTotalBudget(updated.budget);
        setHasDefMod(updated.has_def_mod);
        setHasTeamMod(updated.has_team_mod);
        setTeamCount(updated.team_count);
        setTeamNames(updated.team_names);
        setTeamsData(updated.teams_data);
        setLockedRoles(updated.locked_roles || { P: false, D: false, C: false, A: false });
        setHistory(updated.history || []);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pushStateToSupabase = async (newTeamsData, newHistory, overrides = {}) => {
    setTeamsData(newTeamsData);
    if (newHistory) setHistory(newHistory);

    await supabase.from('rooms').update({
      teams_data: newTeamsData,
      history: newHistory || history,
      budget: overrides.budget !== undefined ? overrides.budget : totalBudget,
      has_def_mod: overrides.hasDefMod !== undefined ? overrides.hasDefMod : hasDefMod,
      has_team_mod: overrides.hasTeamMod !== undefined ? overrides.hasTeamMod : hasTeamMod,
      team_count: overrides.teamCount !== undefined ? overrides.teamCount : teamCount,
      team_names: overrides.teamNames !== undefined ? overrides.teamNames : teamNames,
      locked_roles: overrides.lockedRoles !== undefined ? overrides.lockedRoles : lockedRoles,
      ...overrides
    }).eq('id', roomId);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const code = (newRoomName.trim() || 'LEGA-' + Math.random().toString(36).substring(2, 7)).toUpperCase();
    
    const initialNames = Array.from({ length: 8 }, (_, i) => `Squadra ${i + 1}`);
    const initialData = {};
    for (let i = 0; i < 14; i++) {
      initialData[i] = {
        P: Array(3).fill({ name: '', price: '' }),
        D: Array(8).fill({ name: '', price: '' }),
        C: Array(8).fill({ name: '', price: '' }),
        A: Array(6).fill({ name: '', price: '' })
      };
    }

    const { error } = await supabase.from('rooms').upsert({
      id: code,
      budget: 500,
      has_def_mod: true,
      has_team_mod: true,
      team_count: 8,
      team_names: initialNames,
      teams_data: initialData,
      locked_roles: { P: false, D: false, C: false, A: false },
      history: []
    });

    if (error) {
      alert("Errore nella creazione della stanza. Riprova.");
      return;
    }

    setRoomId(code);
    setIsHost(true);
    setMyTeamIndex(0);
    setTargetTeamIndex(0);
    setInLobby(false);
    window.history.pushState({}, '', `?room=${code}`);
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const code = joinRoomInput.trim().toUpperCase();
    if (!code) return;

    const { data, error } = await supabase.from('rooms').select('*').eq('id', code).single();
    if (error || !data) {
      alert("Stanza non trovata! Verifica il codice o il link.");
      return;
    }

    setRoomId(code);
    setIsHost(false);
    setTotalBudget(data.budget);
    setHasDefMod(data.has_def_mod);
    setHasTeamMod(data.has_team_mod);
    setTeamCount(data.team_count);
    setTeamNames(data.team_names);
    setTeamsData(data.teams_data);
    setLockedRoles(data.locked_roles || { P: false, D: false, C: false, A: false });
    setHistory(data.history || []);
    setInLobby(false);
    window.history.pushState({}, '', `?room=${code}`);
  };

  const handleToggleLockRole = async (roleKey) => {
    if (!isHost) return;
    const updatedLocks = { ...lockedRoles, [roleKey]: !lockedRoles[roleKey] };
    setLockedRoles(updatedLocks);
    await pushStateToSupabase(teamsData, history, { lockedRoles: updatedLocks });
  };

  const handleNameSearchChange = (value) => {
    setQuickName(value);
    if (value.trim().length >= 1) {
      const q = value.toLowerCase();
      const filtered = OFFICIAL_PLAYERS_DB.filter(p =>
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

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);
    await pushStateToSupabase(JSON.parse(lastState), newHistory);
  };

  const handleCellChange = async (teamIdx, role, index, field, value) => {
    // Permesso: se non sei Gestore, puoi modificare solo la tua squadra e se non è bloccata
    if (!isHost) {
      if (myTeamIndex !== teamIdx) return;
      if (lockedRoles[role]) {
        alert(`Il reparto ${role} è stato convalidato e bloccato dal Gestore!`);
        return;
      }
    }

    const updatedTeam = { ...teamsData[teamIdx] };
    const updatedRoleList = [...updatedTeam[role]];
    let parsedVal = value;
    if (field === 'price') {
      parsedVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    }
    updatedRoleList[index] = { ...updatedRoleList[index], [field]: parsedVal };
    updatedTeam[role] = updatedRoleList;

    const nextTeams = { ...teamsData, [teamIdx]: updatedTeam };
    const nextHist = [...history.slice(-20), JSON.stringify(teamsData)];
    await pushStateToSupabase(nextTeams, nextHist);
  };

  const handleClearSlot = async (teamIdx, role, index) => {
    if (!isHost) {
      if (myTeamIndex !== teamIdx) return;
      if (lockedRoles[role]) {
        alert(`Il reparto ${role} è stato convalidato e bloccato dal Gestore!`);
        return;
      }
    }

    const updatedTeam = { ...teamsData[teamIdx] };
    const updatedRoleList = [...updatedTeam[role]];
    updatedRoleList[index] = { name: '', price: '' };
    updatedTeam[role] = updatedRoleList;

    const nextTeams = { ...teamsData, [teamIdx]: updatedTeam };
    const nextHist = [...history.slice(-20), JSON.stringify(teamsData)];
    await pushStateToSupabase(nextTeams, nextHist);
  };

  const handleQuickAssign = async (e) => {
    e.preventDefault();
    if (!quickName.trim()) return;

    const actualTeamIdx = isHost ? targetTeamIndex : myTeamIndex;

    if (actualTeamIdx === null) {
      alert("Seleziona prima quale squadra assegnare!");
      return;
    }

    if (!isHost && lockedRoles[quickRole]) {
      alert(`Il reparto selezionato (${quickRole}) è bloccato e convalidato dal Gestore!`);
      return;
    }

    const teamSlots = teamsData[actualTeamIdx][quickRole];
    const emptyIndex = teamSlots.findIndex(s => !s.name || s.name.trim() === '');

    if (emptyIndex === -1) {
      alert(`Attenzione: ${teamNames[actualTeamIdx]} ha già completato i posti per il ruolo ${quickRole}!`);
      return;
    }

    const finalPrice = quickPrice === '' ? 1 : Math.max(1, parseInt(quickPrice, 10) || 1);
    const updatedTeam = { ...teamsData[actualTeamIdx] };
    const updatedRole = [...updatedTeam[quickRole]];
    updatedRole[emptyIndex] = {
      name: quickName.trim(),
      price: finalPrice
    };
    updatedTeam[quickRole] = updatedRole;

    const nextTeams = { ...teamsData, [actualTeamIdx]: updatedTeam };
    const nextHist = [...history.slice(-20), JSON.stringify(teamsData)];

    await pushStateToSupabase(nextTeams, nextHist);
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

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyReport = () => {
    let report = `🏆 RESOCONTO ASTA FANTACALCIO (Stanza: ${roomId})\n`;
    report += `Budget: ${totalBudget} | Mod. Difesa: ${hasDefMod ? 'SI' : 'NO'} | Mod. Squadra: ${hasTeamMod ? 'SI' : 'NO'}\n\n`;

    for (let i = 0; i < teamCount; i++) {
      const tName = teamNames[i] || `Squadra ${i + 1}`;
      const stats = getTeamStats(i);
      report += `==============================\n`;
      report += `SQUADRA: ${tName.toUpperCase()} (Spesi: ${stats.totalSpent}/${totalBudget} - Residui: ${stats.remainingBudget})\n`;
      report += `------------------------------\n`;
      ['P', 'D', 'C', 'A'].forEach(rKey => {
        const rName = rKey === 'P' ? 'Portieri' : rKey === 'D' ? 'Difensori' : rKey === 'C' ? 'Centrocampisti' : 'Attaccanti';
        report += `[${rName}]\n`;
        teamsData[i][rKey].forEach((slot, idx) => {
          if (slot.name) {
            report += `  ${idx + 1}. ${slot.name} (${slot.price || 1} crediti)\n`;
          }
        });
      });
      report += `\n`;
    }

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  // LOBBY INIZIALE
  if (inLobby) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-black text-white tracking-wide">ASTA FANTACALCIO LIVE</h1>
            <p className="text-xs text-slate-400">Sincronizzazione in tempo reale con controllo Gestore completo</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> SEI IL GESTORE DELL'ASTA?
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-2">
              <input
                type="text"
                placeholder="Nome/Codice Stanza (es. MIKAELONA)"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 uppercase"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition shadow cursor-pointer"
              >
                Crea Nuova Stanza Lega
              </button>
            </form>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-400">
              <Users className="w-4 h-4" /> SEI UN PARTECIPANTE (OSPITE)?
            </div>
            <form onSubmit={handleJoinRoom} className="space-y-2">
              <input
                type="text"
                required
                placeholder="Incolla Codice Stanza (es. MIKAELONA)"
                value={joinRoomInput}
                onChange={e => setJoinRoomInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 uppercase"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-sm transition shadow cursor-pointer"
              >
                Entra nell'Asta
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // TABELLONE ASTA IN DIRETTA
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* 1. Header Principale Fissa */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex-shrink-0 z-30 shadow-md">
        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black text-emerald-300">LIVE: {roomId} {isHost && '(GESTORE)'}</span>
            </div>

            {/* Selettore Squadra: Per Ospite è la propria, per il Gestore è facoltativo */}
            {!isHost ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1 rounded-lg text-xs">
                <span className="text-slate-400 font-bold">La tua squadra:</span>
                <select
                  value={myTeamIndex === null ? '' : myTeamIndex}
                  onChange={(e) => setMyTeamIndex(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-600 rounded px-2 py-0.5 font-black text-amber-300 outline-none cursor-pointer"
                >
                  <option value="">-- Seleziona la tua squadra --</option>
                  {Array.from({ length: teamCount }).map((_, idx) => (
                    <option key={idx} value={idx}>{teamNames[idx] || `Squadra ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" /> Accesso Totale Gestore
              </div>
            )}

            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800 px-3 py-1 rounded border border-slate-700">
              <span>Budget: <strong className="text-emerald-400">{totalBudget}</strong></span>
              <span>•</span>
              <span>Mod. Difesa: {hasDefMod ? '✅' : '❌'}</span>
              <span>•</span>
              <span>Mod. Squadra: {hasTeamMod ? '✅' : '❌'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyInviteLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow transition cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {copiedLink ? 'Link Copiato!' : 'Invita Partecipanti'}
            </button>

            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded shadow transition cursor-pointer"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedReport ? 'Report Copiato!' : 'Copia Rose per Presidente'}
            </button>

            {isHost && (
              <>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded shadow transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Annulla azione
                  </button>
                )}

                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white rounded shadow transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" /> Regole Lega
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Barra Assegnazione Rapida */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-4 py-2 flex-shrink-0 z-20 shadow">
        <form onSubmit={handleQuickAssign} className="w-full flex flex-wrap items-center gap-3 relative">
          <span className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4" /> Assegna a:
          </span>

          {/* Selezione squadra: Visibile sempre per il Gestore, fissa per l'ospite */}
          {isHost ? (
            <select
              value={targetTeamIndex}
              onChange={e => setTargetTeamIndex(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-sm font-bold text-emerald-300 outline-none cursor-pointer"
            >
              {Array.from({ length: teamCount }).map((_, idx) => (
                <option key={idx} value={idx}>{teamNames[idx] || `Squadra ${idx + 1}`}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-bold text-white bg-slate-950 px-2 py-1 rounded border border-slate-700">
              {myTeamIndex !== null ? teamNames[myTeamIndex] : 'Nessuna squadra'}
            </span>
          )}

          <div className="flex-1 min-w-[260px] relative" ref={suggestionRef}>
            <input
              type="text"
              required
              disabled={!isHost && myTeamIndex === null}
              placeholder={!isHost && myTeamIndex === null ? "⚠️ Seleziona prima la tua squadra in alto!" : "Digita nome giocatore (es. Lautaro, Dimarco)..."}
              value={quickName}
              onChange={e => handleNameSearchChange(e.target.value)}
              onFocus={() => quickName.length >= 1 && setShowSuggestions(true)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-3 py-1.5 text-base text-white placeholder-slate-500 outline-none disabled:opacity-50"
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
            disabled={!isHost && myTeamIndex === null}
            onChange={e => setQuickRole(e.target.value)}
            className="bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-sm font-bold text-white outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="P">P (Portiere)</option>
            <option value="D">D (Difensore)</option>
            <option value="C">C (Centrocampista)</option>
            <option value="A">A (Attaccante)</option>
          </select>

          <input
            type="number"
            min="1"
            max={totalBudget}
            required
            disabled={!isHost && myTeamIndex === null}
            placeholder="Prezzo"
            value={quickPrice}
            onChange={e => setQuickPrice(e.target.value)}
            className="w-24 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded px-2.5 py-1.5 text-base font-bold text-amber-300 text-center outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!isHost && myTeamIndex === null}
            className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-sm font-bold rounded shadow transition cursor-pointer"
          >
            Conferma Acquisto
          </button>
        </form>
      </div>

      {/* 3. Tabellone Squadre */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-3 w-full">
        <div className="flex gap-3 w-max min-w-full h-full">
          {Array.from({ length: teamCount }).map((_, teamIdx) => {
            const stats = getTeamStats(teamIdx);
            const isMyTeam = myTeamIndex === teamIdx;
            // Il Gestore ha sempre il permesso di modifica; l'ospite solo sulla propria squadra
            const canEditThisColumn = isHost || isMyTeam;

            return (
              <div
                key={teamIdx}
                className={`w-[280px] flex-shrink-0 flex flex-col bg-slate-900 border rounded-lg overflow-hidden shadow h-full transition-all ${
                  isMyTeam ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800'
                }`}
              >
                {/* Intestazione Squadra */}
                <div className={`flex-shrink-0 p-2 border-b text-center shadow ${isMyTeam ? 'bg-slate-800 border-emerald-500/40' : 'bg-slate-800/80 border-slate-700'}`}>
                  <div className="flex items-center justify-between px-1">
                    {isHost ? (
                      <input
                        type="text"
                        value={teamNames[teamIdx]}
                        onChange={(e) => {
                          const updated = [...teamNames];
                          updated[teamIdx] = e.target.value;
                          setTeamNames(updated);
                          pushStateToSupabase(teamsData, history, { teamNames: updated });
                        }}
                        placeholder={`Squadra ${teamIdx + 1}`}
                        className="w-full bg-transparent text-center font-extrabold text-base text-emerald-300 focus:bg-slate-950 rounded px-1.5 py-0.5 outline-none border border-transparent focus:border-emerald-500 transition"
                      />
                    ) : (
                      <h3 className="font-extrabold text-base text-emerald-300 truncate w-full text-center">
                        {teamNames[teamIdx] || `Squadra ${teamIdx + 1}`}
                      </h3>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs mt-1 px-1 text-slate-300">
                    <span className="flex items-center gap-1">
                      {isHost ? (
                        <span className="text-emerald-400 font-bold">● Gestore (Modifica attiva)</span>
                      ) : isMyTeam ? (
                        <span className="text-emerald-400 font-bold">● La tua squadra</span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-0.5"><Lock className="w-3 h-3" /> Sola lettura</span>
                      )}
                    </span>
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
                    const isRoleLocked = lockedRoles[roleKey];
                    
                    // Il Gestore può sempre modificare; l'ospite può modificare solo la sua colonna e solo se non è lockato
                    const canEditSlot = isHost || (isMyTeam && !isRoleLocked);

                    return (
                      <div key={roleKey} className={`rounded border ${roleConf.border} ${roleConf.bg} p-1.5 transition-all`}>
                        {/* Tasto Blocca Sopra al Reparto (per Gestore) & Badge di Stato */}
                        <div className="flex justify-between items-center mb-1.5 px-0.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${roleConf.badge}`}>
                            {roleConf.name} ({slots.filter(s => s.name.trim()).length}/{roleConf.count})
                          </span>

                          {isHost ? (
                            <button
                              type="button"
                              onClick={() => handleToggleLockRole(roleKey)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black shadow transition cursor-pointer ${
                                isRoleLocked 
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                              }`}
                            >
                              {isRoleLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              {isRoleLocked ? 'Sblocca' : 'Blocca & Convalida'}
                            </button>
                          ) : (
                            isRoleLocked && (
                              <span className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[10px] font-black px-1.5 py-0.5 rounded">
                                <Lock className="w-2.5 h-2.5" /> Bloccato
                              </span>
                            )
                          )}
                        </div>

                        {/* Totale Speso Reparto */}
                        <div className="flex justify-between items-center mb-1 px-1 text-xs text-slate-300 font-bold">
                          <span>Totale Reparto:</span>
                          <strong className="text-amber-300">{spentRole} €</strong>
                        </div>

                        {/* Righe Giocatori */}
                        <div className="space-y-1">
                          {slots.map((slot, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <input
                                type="text"
                                disabled={!canEditSlot}
                                placeholder={`${roleKey}${idx + 1}`}
                                value={slot.name}
                                onChange={e => handleCellChange(teamIdx, roleKey, idx, 'name', e.target.value)}
                                className={`flex-1 min-w-0 rounded px-2 py-1 text-[15px] font-semibold text-white focus:outline-none whitespace-nowrap overflow-x-auto ${
                                  canEditSlot ? 'bg-slate-950 border border-slate-700 focus:border-emerald-400' : 'bg-slate-900/60 border border-slate-800 text-slate-300 cursor-not-allowed'
                                }`}
                              />
                              <input
                                type="number"
                                min="0"
                                max={totalBudget}
                                disabled={!canEditSlot}
                                placeholder="€"
                                value={slot.price}
                                onChange={e => handleCellChange(teamIdx, roleKey, idx, 'price', e.target.value)}
                                className={`w-14 flex-shrink-0 rounded px-1 py-1 text-[15px] font-black text-center text-amber-400 focus:outline-none ${
                                  canEditSlot ? 'bg-slate-950 border border-slate-700 focus:border-emerald-400' : 'bg-slate-900/60 border border-slate-800 text-amber-500/80 cursor-not-allowed'
                                }`}
                              />
                              {canEditSlot && slot.name ? (
                                <button
                                  type="button"
                                  onClick={() => handleClearSlot(teamIdx, roleKey, idx)}
                                  title="Cancella slot"
                                  className="p-1 flex-shrink-0 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded transition cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="w-[22px] flex-shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Percentuale Spesa */}
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

      {/* Modal Impostazioni */}
      {isConfigOpen && isHost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" /> Configura Regole Lega (Stanza: {roomId})
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
                  onChange={(e) => {
                    const val = Math.max(100, parseInt(e.target.value, 10) || 500);
                    setTotalBudget(val);
                    pushStateToSupabase(teamsData, history, { budget: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-amber-300 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Numero di Squadre Partecipanti:</label>
                <select
                  value={teamCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value, 10);
                    setTeamCount(count);
                    pushStateToSupabase(teamsData, history, { teamCount: count });
                  }}
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
                    onChange={(e) => {
                      const mod = e.target.value === "SI";
                      setHasDefMod(mod);
                      pushStateToSupabase(teamsData, history, { hasDefMod: mod });
                    }}
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
                    onChange={(e) => {
                      const mod = e.target.value === "SI";
                      setHasTeamMod(mod);
                      pushStateToSupabase(teamsData, history, { hasTeamMod: mod });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm font-bold text-emerald-400 outline-none"
                  >
                    <option value="SI">Attivo ✅</option>
                    <option value="NO">Disattivo ❌</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setIsConfigOpen(false)}
                className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition shadow cursor-pointer"
              >
                Salva e Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
