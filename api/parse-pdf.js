import pdfParse from 'pdf-parse';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const SERIE_A_TEAMS = [
  'Atalanta', 'Bologna', 'Cagliari', 'Como', 'Fiorentina', 'Frosinone',
  'Genoa', 'Inter', 'Juventus', 'Lazio', 'Lecce', 'Milan', 'Monza',
  'Napoli', 'Parma', 'Roma', 'Sassuolo', 'Torino', 'Udinese', 'Venezia'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  try {
    const { base64 } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'Nessun file ricevuto' });
    }

    const buffer = Buffer.from(base64, 'base64');
    const data = await pdfParse(buffer);
    const text = data.text || '';

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const players = [];
    let currentRole = 'P';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('Portieri')) currentRole = 'P';
      else if (line.includes('Difensori')) currentRole = 'D';
      else if (line.includes('Centrocampisti')) currentRole = 'C';
      else if (line.includes('Attaccanti')) currentRole = 'A';

      const tokens = line.split(/\s+/);
      const teamFound = SERIE_A_TEAMS.find(t => line.toLowerCase().includes(t.toLowerCase()));

      if (teamFound) {
        let role = currentRole;
        const roleTok = tokens.find(tok => tok.match(/^[PDCA](\(.*\))?$/i) || tok.match(/^[PDCA]$/i));
        if (roleTok) {
          role = roleTok.charAt(0).toUpperCase();
        }

        const nameCandidates = tokens.filter(tok => 
          !tok.startsWith('#') &&
          isNaN(tok) &&
          tok.toLowerCase() !== teamFound.toLowerCase() &&
          !tok.match(/^[PDCA](\(.*\))?$/i) &&
          !['Portieri', 'Difensori', 'Centrocampisti', 'Attaccanti', 'Nome', 'Squadra', 'FVM', 'Quot', 'R.', 'Qt.', 'FVM/Qt'].includes(tok)
        );

        if (nameCandidates.length > 0) {
          const name = nameCandidates.join(' ');
          if (name.length >= 2) {
            players.push({ name, role, team: teamFound });
          }
        }
      }
    }

    // Fallback: scansione su tutto il testo tokenizzato
    if (players.length === 0) {
      const allTokens = text.split(/\s+/).filter(Boolean);
      for (let i = 0; i < allTokens.length; i++) {
        const teamMatch = SERIE_A_TEAMS.find(t => t.toLowerCase() === allTokens[i].toLowerCase());
        if (teamMatch && i >= 1) {
          const candidateName = allTokens[i - 1];
          let role = currentRole;
          if (i >= 2 && allTokens[i - 2].match(/^[PDCA]/i)) {
            role = allTokens[i - 2].charAt(0).toUpperCase();
          }
          if (candidateName && isNaN(candidateName) && !candidateName.startsWith('#')) {
            players.push({ name: candidateName, role, team: teamMatch });
          }
        }
      }
    }

    // Deduplicazione
    const unique = [];
    const seen = new Set();
    players.forEach(p => {
      const key = `${p.name.toLowerCase()}_${p.role}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(p);
      }
    });

    return res.status(200).json({ players: unique });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Errore durante la scansione del PDF' });
  }
}
