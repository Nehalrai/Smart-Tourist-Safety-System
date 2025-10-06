// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const path = require('path');
const { encrypt, decrypt, encryptObject, decryptObject } = require('./encryption');
const { initializeSMS, sendEmergencySMS, isSMSAvailable, getSMSStatus } = require('./smsService');

const app = express();
app.use(cors());
app.use(express.json());

// --- SQLite setup ---
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tourists (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      nationality TEXT NOT NULL,
      passport TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      emergency_contact_name TEXT NOT NULL,
      emergency_contact_phone TEXT NOT NULL,
      emergency_contact_email TEXT NOT NULL,
      password TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      tourist_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS authorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // --- Migration: ensure tourists.password column exists for older databases ---
  db.all(`PRAGMA table_info(tourists)`, (err, columns) => {
    if (err) {
      console.error('Failed to inspect tourists table:', err);
      return;
    }

    const hasPasswordColumn = Array.isArray(columns) && columns.some((c) => c && (c.name === 'password'));
    if (!hasPasswordColumn) {
      // Add the password column with a safe default to satisfy NOT NULL constraint for existing rows
      db.run(`ALTER TABLE tourists ADD COLUMN password TEXT NOT NULL DEFAULT ''`, (alterErr) => {
        if (alterErr) {
          console.error('Failed to add password column to tourists:', alterErr);
        } else {
          console.log('Migration applied: added password column to tourists');
        }
      });
    }
  });

  // --- Initialize sample authority accounts with encrypted credentials ---
  db.get(`SELECT COUNT(*) as count FROM authorities`, (err, result) => {
    if (err) {
      console.error('Failed to check authorities count:', err);
      return;
    }
    
    if (result.count === 0) {
      // Create sample authority accounts with encrypted credentials
      const sampleAuthorities = [
        { username: 'admin', password: 'admin123', name: 'System Administrator', role: 'admin' },
        { username: 'police', password: 'police123', name: 'Police Officer', role: 'police' },
        { username: 'emergency', password: 'emergency123', name: 'Emergency Services', role: 'emergency' }
      ];
      
      sampleAuthorities.forEach(auth => {
        const encryptedAuth = encryptObject(auth, ['username', 'password', 'name']);
        const createdAt = new Date().toISOString();
        
        db.run(
          `INSERT INTO authorities (username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)`,
          [encryptedAuth.username, encryptedAuth.password, encryptedAuth.name, auth.role, createdAt],
          (insertErr) => {
            if (insertErr) {
              console.error('Failed to insert sample authority:', insertErr);
            } else {
              console.log(`Sample authority account created: ${auth.username}`);
            }
          }
        );
      });
    }
  });
});

// Initialize SMS service
initializeSMS();

// Helper to create mock blockchain tx hash
function makeTxHash() {
  // 32 hex bytes → looks like a real tx hash.
  return '0x' + crypto.randomBytes(32).toString('hex');
}

// --- Routes ---
app.post('/api/register', (req, res) => {
  const { 
    fullName, 
    nationality, 
    passport, 
    phone, 
    email, 
    emergencyContactName, 
    emergencyContactPhone, 
    emergencyContactEmail,
    password
  } = req.body || {};

  if (!fullName || !nationality || !passport || !phone || !emergencyContactName || !emergencyContactPhone || !emergencyContactEmail || !password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Check if tourist already exists (by passport) - decrypt passport for comparison
  db.all(`SELECT * FROM tourists`, (err, allTourists) => {
    if (err) {
      console.error('DB check error:', err);
      return res.status(500).json({ error: 'DB check failed.' });
    }
    
    // Check if tourist already exists by decrypting and comparing passports
    const existingTourist = allTourists.find(tourist => {
      try {
        const decryptedPassport = decrypt(tourist.passport);
        return decryptedPassport === passport;
      } catch (error) {
        console.error('Error decrypting passport during check:', error);
        return false;
      }
    });
    
    if (existingTourist) {
      return res.status(409).json({ error: 'Tourist already registered. Please login instead.' });
    }

    const id = 'TID-' + uuidv4().split('-')[0].toUpperCase(); // e.g., TID-8F92A1
    const txHash = makeTxHash();
    const createdAt = new Date().toISOString();

    // Encrypt sensitive data before storing
    const encryptedData = encryptObject({
      fullName,
      nationality,
      passport,
      phone,
      email: email || '',
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactEmail,
      password
    }, ['fullName', 'nationality', 'passport', 'phone', 'email', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactEmail', 'password']);

    db.run(
      `INSERT INTO tourists (id, full_name, nationality, passport, phone, email, emergency_contact_name, emergency_contact_phone, emergency_contact_email, password, tx_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, encryptedData.fullName, encryptedData.nationality, encryptedData.passport, encryptedData.phone, encryptedData.email, encryptedData.emergencyContactName, encryptedData.emergencyContactPhone, encryptedData.emergencyContactEmail, encryptedData.password, txHash, createdAt],
      function (err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'DB insert failed.' });
        }
        return res.json({
          touristId: id,
          txHash,
          createdAt,
          // echo back safe profile data for the card
          profile: { 
            fullName, 
            nationality, 
            passport, 
            phone, 
            email: email || '',
            emergencyContactName,
            emergencyContactPhone,
            emergencyContactEmail
          }
        });
      }
    );
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { passport, password } = req.body;
  
  if (!passport || !password) {
    return res.status(400).json({ error: 'Passport and password required.' });
  }

  // Get all tourists and decrypt to find matching credentials
  db.all(`SELECT * FROM tourists`, (err, allTourists) => {
    if (err) {
      console.error('DB login error:', err);
      return res.status(500).json({ error: 'DB login failed.' });
    }
    
    // Find tourist by decrypting and comparing credentials
    const tourist = allTourists.find(t => {
      try {
        const decryptedPassport = decrypt(t.passport);
        const decryptedPassword = decrypt(t.password);
        return decryptedPassport === passport && decryptedPassword === password;
      } catch (error) {
        console.error('Error decrypting during login:', error);
        return false;
      }
    });
    
    if (!tourist) {
      return res.status(401).json({ error: 'Invalid passport or password.' });
    }

    // Decrypt tourist data for response
    const decryptedTourist = decryptObject(tourist, [
      'full_name', 'nationality', 'passport', 'phone', 'email', 
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
    ]);

    res.json({
      touristId: tourist.id,
      profile: {
        fullName: decryptedTourist.full_name,
        nationality: decryptedTourist.nationality,
        passport: decryptedTourist.passport,
        phone: decryptedTourist.phone,
        email: decryptedTourist.email,
        emergencyContactName: decryptedTourist.emergency_contact_name,
        emergencyContactPhone: decryptedTourist.emergency_contact_phone,
        emergencyContactEmail: decryptedTourist.emergency_contact_email
      },
      txHash: tourist.tx_hash,
      createdAt: tourist.created_at
    });
  });
});

// Authority login endpoint
app.post('/api/authority/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  // Get all authorities and decrypt to find matching credentials
  db.all(`SELECT * FROM authorities`, (err, allAuthorities) => {
    if (err) {
      console.error('Authority login error:', err);
      return res.status(500).json({ error: 'Authority login failed.' });
    }
    
    // Find authority by decrypting and comparing credentials
    const authority = allAuthorities.find(a => {
      try {
        const decryptedUsername = decrypt(a.username);
        const decryptedPassword = decrypt(a.password);
        return decryptedUsername === username && decryptedPassword === password;
      } catch (error) {
        console.error('Error decrypting authority credentials:', error);
        return false;
      }
    });
    
    if (!authority) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Decrypt authority data for response
    const decryptedAuthority = decryptObject(authority, ['username', 'name']);

    res.json({
      id: authority.id,
      username: decryptedAuthority.username,
      name: decryptedAuthority.name,
      role: authority.role,
      authenticated: true
    });
  });
});

app.get('/api/tourists/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT * FROM tourists WHERE id = ?`, [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB read failed.' });
    if (!row) return res.status(404).json({ error: 'Not found.' });
    
    // Decrypt sensitive data before returning
    const decryptedRow = decryptObject(row, [
      'full_name', 'nationality', 'passport', 'phone', 'email', 
      'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
    ]);
    
    res.json(decryptedRow);
  });
});

// Get all tourists for authority dashboard (unique by passport)
app.get('/api/tourists', (req, res) => {
  db.all(`SELECT * FROM tourists ORDER BY created_at DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read failed.' });
    
    // Decrypt all tourist data first
    const decryptedRows = rows.map(tourist => 
      decryptObject(tourist, [
        'full_name', 'nationality', 'passport', 'phone', 'email', 
        'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
      ])
    );
    
    // Group by passport to get unique tourists (keep latest registration)
    const uniqueTourists = {};
    decryptedRows.forEach(tourist => {
      if (!uniqueTourists[tourist.passport] || new Date(tourist.created_at) > new Date(uniqueTourists[tourist.passport].created_at)) {
        uniqueTourists[tourist.passport] = tourist;
      }
    });
    
    const result = Object.values(uniqueTourists).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(result);
  });
});

// Alerts API
app.post('/api/alerts', (req, res) => {
  const { id, type, message, timestamp, touristId, severity } = req.body;
  
  if (!id || !type || !message || !timestamp || !touristId || !severity) {
    return res.status(400).json({ error: 'Missing required alert fields.' });
  }

  const createdAt = new Date().toISOString();
  
  db.run(
    `INSERT INTO alerts (alert_id, type, message, timestamp, tourist_id, severity, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, type, message, timestamp, touristId, severity, createdAt],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Alert insert failed.' });
      }
      return res.json({ success: true, alertId: id });
    }
  );
});

app.get('/api/alerts', (req, res) => {
  db.all(`SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Alerts fetch failed.' });
    res.json(rows);
  });
});

app.get('/api/alerts/:touristId', (req, res) => {
  const { touristId } = req.params;
  db.all(`SELECT * FROM alerts WHERE tourist_id = ? ORDER BY created_at DESC`, [touristId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Tourist alerts fetch failed.' });
    res.json(rows);
  });
});

// SMS Emergency endpoint
app.post('/api/sms/emergency', async (req, res) => {
  const { touristId, emergencyType, location } = req.body;
  
  if (!touristId) {
    return res.status(400).json({ error: 'Tourist ID required.' });
  }

  try {
    // Get tourist information
    const tourist = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM tourists WHERE id = ?`, [touristId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!tourist) {
      return res.status(404).json({ error: 'Tourist not found.' });
    }

    // Decrypt tourist data
    const decryptedTourist = decryptObject(tourist, [
      'full_name', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_email'
    ]);

    // Send emergency SMS
    const smsResult = await sendEmergencySMS(
      {
        emergencyContactName: decryptedTourist.emergency_contact_name,
        emergencyContactPhone: decryptedTourist.emergency_contact_phone,
        emergencyContactEmail: decryptedTourist.emergency_contact_email
      },
      decryptedTourist.full_name,
      touristId,
      emergencyType || 'sos',
      location || 'Demo Map Zone'
    );

    res.json({
      success: smsResult.success,
      message: smsResult.success ? 'Emergency SMS sent successfully' : 'Failed to send emergency SMS',
      smsResult: smsResult,
      touristName: decryptedTourist.full_name
    });

  } catch (error) {
    console.error('Emergency SMS error:', error);
    res.status(500).json({ error: 'Failed to send emergency SMS.' });
  }
});

// SMS Status endpoint
app.get('/api/sms/status', (req, res) => {
  const status = getSMSStatus();
  res.json({
    smsAvailable: isSMSAvailable(),
    status: status,
    message: status.enabled ? 'SMS service is available' : 'SMS service is not available'
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
