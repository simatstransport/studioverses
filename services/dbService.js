let sqlite3Lib = null;
let isNodeSqlite = false;

try {
  sqlite3Lib = require('sqlite3').verbose();
} catch (e1) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    sqlite3Lib = DatabaseSync;
    isNodeSqlite = true;
  } catch (e2) {
    console.warn('[Database] Neither sqlite3 nor node:sqlite could be loaded.');
  }
}

const path = require('path');
const fs = require('fs');
const config = require('../config');

class BibleDatabaseService {
  constructor() {
    this.kjvDb = null;
    this.tamilDb = null;
    this.booksEn = [];
    this.booksTa = [];
    this.initialized = false;

    // Common Bible book abbreviation mappings (to 1-based book index 1..66)
    this.abbreviations = {
      // Old Testament
      'gen': 1, 'genesis': 1,
      'ex': 2, 'exo': 2, 'exod': 2, 'exodus': 2,
      'lev': 3, 'leviticus': 3,
      'num': 4, 'numbers': 4,
      'deut': 5, 'dt': 5, 'deuteronomy': 5,
      'josh': 6, 'joshua': 6,
      'judg': 7, 'judges': 7,
      'ruth': 8,
      '1sam': 9, '1 sam': 9, '1 samuel': 9,
      '2sam': 10, '2 sam': 10, '2 samuel': 10,
      '1ki': 11, '1 ki': 11, '1kings': 11, '1 kings': 11, '1kgs': 11, '1 kgs': 11,
      '2ki': 12, '2 ki': 12, '2kings': 12, '2 kings': 12, '2kgs': 12, '2 kgs': 12,
      '1chr': 13, '1 chr': 13, '1 chron': 13, '1 chronicles': 13,
      '2chr': 14, '2 chr': 14, '2 chron': 14, '2 chronicles': 14,
      'ezra': 15,
      'neh': 16, 'nehemiah': 16,
      'esth': 17, 'esther': 17,
      'job': 18,
      'ps': 19, 'psa': 19, 'psalm': 19, 'psalms': 19,
      'prov': 20, 'proverbs': 20,
      'eccl': 21, 'ecc': 21, 'ecclesiastes': 21,
      'song': 22, 'songs': 22, 'song of solomon': 22, 'song of songs': 22,
      'isa': 23, 'isaiah': 23,
      'jer': 24, 'jeremiah': 24,
      'lam': 25, 'lamentations': 25,
      'ezek': 26, 'eze': 26, 'ezekiel': 26,
      'dan': 27, 'daniel': 27,
      'hos': 28, 'hosea': 28,
      'joel': 29,
      'amos': 30,
      'obad': 31, 'obadiah': 31,
      'jonah': 32, 'jon': 32,
      'mic': 33, 'micah': 33,
      'nah': 34, 'nahum': 34,
      'hab': 35, 'habakkuk': 35,
      'zeph': 36, 'zephaniah': 36,
      'hag': 37, 'haggai': 37,
      'zech': 38, 'zechariah': 38,
      'mal': 39, 'malachi': 39,

      // New Testament
      'matt': 40, 'mat': 40, 'matthew': 40,
      'mark': 41, 'mk': 41, 'mrk': 41,
      'luke': 42, 'lk': 42, 'luk': 42,
      'john': 43, 'jn': 43, 'jhn': 43,
      'acts': 44, 'act': 44,
      'rom': 45, 'romans': 45,
      '1cor': 46, '1 cor': 46, '1 corinthians': 46,
      '2cor': 47, '2 cor': 47, '2 corinthians': 47,
      'gal': 48, 'galatians': 48,
      'eph': 49, 'ephesians': 49,
      'phil': 50, 'philippians': 50,
      'col': 51, 'colossians': 51,
      '1thess': 52, '1 thess': 52, '1 thessalonians': 52,
      '2thess': 53, '2 thess': 53, '2 thessalonians': 53,
      '1tim': 54, '1 tim': 54, '1 timothy': 54,
      '2tim': 55, '2 tim': 55, '2 timothy': 55,
      'titus': 56, 'tit': 56,
      'philem': 57, 'phm': 57, 'philemon': 57,
      'heb': 58, 'hebrews': 58,
      'jas': 59, 'james': 59,
      '1pet': 60, '1 pet': 60, '1 peter': 60,
      '2pet': 61, '2 pet': 61, '2 peter': 61,
      '1jn': 62, '1 jn': 62, '1 john': 62,
      '2jn': 63, '2 jn': 63, '2 john': 63,
      '3jn': 64, '3 jn': 64, '3 john': 64,
      'jude': 65,
      'rev': 66, 'revelation': 66, 'revelations': 66
    };
  }

  async init() {
    if (this.initialized) return;

    if (!fs.existsSync(config.kjvDbPath)) {
      throw new Error(`KJV database not found at ${config.kjvDbPath}`);
    }
    if (!fs.existsSync(config.tamilDbPath)) {
      throw new Error(`Tamil database not found at ${config.tamilDbPath}`);
    }

    this.kjvDb = await this._openDb(config.kjvDbPath);
    this.tamilDb = await this._openDb(config.tamilDbPath);

    // Load book names from configuration table
    await this._loadBookNames();
    this.initialized = true;
    console.log(`[Database] Initialized successfully. Loaded ${this.booksEn.length} English books and ${this.booksTa.length} Tamil books.`);
  }

  _openDb(filePath) {
    if (isNodeSqlite) {
      return new sqlite3Lib(filePath, { readOnly: true });
    }
    return new Promise((resolve, reject) => {
      const db = new sqlite3Lib.Database(filePath, sqlite3Lib.OPEN_READONLY, (err) => {
        if (err) return reject(err);
        resolve(db);
      });
    });
  }

  _query(db, sql, params = []) {
    if (isNodeSqlite) {
      try {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...params);
        return Promise.resolve(rows);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async _loadBookNames() {
    try {
      const kjvConfig = await this._query(this.kjvDb, 'SELECT booknames FROM configuration LIMIT 1');
      if (kjvConfig && kjvConfig[0] && kjvConfig[0].booknames) {
        this.booksEn = this._parseBookNames(kjvConfig[0].booknames);
      }
    } catch (e) {
      console.warn('[Database] Could not load KJV book names from configuration:', e.message);
    }

    try {
      const tamilConfig = await this._query(this.tamilDb, 'SELECT booknames FROM configuration LIMIT 1');
      if (tamilConfig && tamilConfig[0] && tamilConfig[0].booknames) {
        this.booksTa = this._parseBookNames(tamilConfig[0].booknames);
      }
    } catch (e) {
      console.warn('[Database] Could not load Tamil book names from configuration:', e.message);
    }

    // Register books in lookup
    this.booksEn.forEach((name, idx) => {
      const clean = name.trim().toLowerCase();
      this.abbreviations[clean] = idx + 1;
    });

    this.booksTa.forEach((name, idx) => {
      const clean = name.trim().toLowerCase();
      this.abbreviations[clean] = idx + 1;
    });
  }

  _parseBookNames(raw) {
    // raw can be formatted as: "Genesis","Exodus",... or 'ஆதியாகமம்','யாத்திராகமம்',...
    return raw
      .split(',')
      .map(s => s.replace(/^['"\s]+|['"\s]+$/g, '').trim())
      .filter(Boolean);
  }

  getBookNameEn(bookNum) {
    return this.booksEn[bookNum - 1] || `Book ${bookNum}`;
  }

  getBookNameTa(bookNum) {
    return this.booksTa[bookNum - 1] || `புத்தகம் ${bookNum}`;
  }

  /**
   * Resolves a reference like "1 Kings 8:15", "Isa 40:31", "Jn 3:16" to { bookNum, chapter, verse }
   */
  parseReference(refString) {
    if (!refString || typeof refString !== 'string') {
      throw new Error('Reference query must be a non-empty string');
    }

    const trimmed = refString.trim();
    // Match patterns like "1 Kings 8:15", "Genesis 1:1", "1Jn 2:3", "Psalm 23:1"
    const regex = /^((?:[1-3]\s*)?[a-zA-Z\u0B80-\u0BFF\s]+?)\s*(\d+)[:\s.]+(\d+)$/;
    const match = trimmed.match(regex);

    if (!match) {
      throw new Error(`Invalid verse reference format: "${refString}". Example formats: "1 Kings 8:15", "Isa 40:31", "John 3:16"`);
    }

    let bookPart = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const chapter = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);

    let bookNum = this.abbreviations[bookPart];
    if (!bookNum) {
      // Try removing spaces (e.g. "1 kings" -> "1kings")
      bookNum = this.abbreviations[bookPart.replace(/\s+/g, '')];
    }

    if (!bookNum) {
      // Fuzzy prefix search
      const entry = Object.entries(this.abbreviations).find(([k]) => bookPart.startsWith(k) || k.startsWith(bookPart));
      if (entry) bookNum = entry[1];
    }

    if (!bookNum || bookNum < 1 || bookNum > 66) {
      throw new Error(`Could not identify book: "${match[1]}". Please check the spelling.`);
    }

    return { bookNum, chapter, verse };
  }

  /**
   * Fetches a specific verse by reference string or coordinates
   */
  async getVerse(queryOrCoords) {
    await this.init();

    let coords;
    if (typeof queryOrCoords === 'string') {
      coords = this.parseReference(queryOrCoords);
    } else {
      coords = queryOrCoords;
    }

    const { bookNum, chapter, verse } = coords;

    const kjvRow = await this._query(
      this.kjvDb,
      'SELECT wordId, word, bookNum, chNum, verseNum FROM words WHERE bookNum = ? AND chNum = ? AND verseNum = ? LIMIT 1',
      [bookNum, chapter, verse]
    );

    const tamilRow = await this._query(
      this.tamilDb,
      'SELECT wordId, word, bookNum, chNum, verseNum FROM words WHERE bookNum = ? AND chNum = ? AND verseNum = ? LIMIT 1',
      [bookNum, chapter, verse]
    );

    if (!kjvRow || kjvRow.length === 0) {
      throw new Error(`Verse not found: ${this.getBookNameEn(bookNum)} ${chapter}:${verse}`);
    }

    const bookEn = this.getBookNameEn(bookNum);
    const bookTa = this.getBookNameTa(bookNum);

    return {
      bookNum,
      chapter,
      verse,
      textEn: kjvRow[0].word.trim(),
      textTa: tamilRow && tamilRow[0] ? tamilRow[0].word.trim() : '',
      referenceEn: `${bookEn} ${chapter}:${verse}`,
      referenceTa: `${bookTa} ${chapter}:${verse}`
    };
  }

  /**
   * Fetches a random daily verse from the 31,102 verses
   */
  async getRandomVerse() {
    await this.init();

    // Select random wordId from 1 to 31102
    const totalCountRow = await this._query(this.kjvDb, 'SELECT MAX(wordId) as maxId FROM words');
    const maxId = totalCountRow[0]?.maxId || 31102;
    const randomId = Math.floor(Math.random() * maxId) + 1;

    const kjvRow = await this._query(
      this.kjvDb,
      'SELECT wordId, word, bookNum, chNum, verseNum FROM words WHERE wordId = ? LIMIT 1',
      [randomId]
    );

    if (!kjvRow || kjvRow.length === 0) {
      // Fallback to John 3:16 (bookNum: 43, chNum: 3, verseNum: 16)
      return this.getVerse({ bookNum: 43, chapter: 3, verse: 16 });
    }

    const { bookNum, chNum, verseNum } = kjvRow[0];
    return this.getVerse({ bookNum, chapter: chNum, verse: verseNum });
  }

  /**
   * Search verses by text query
   */
  async search(query, limit = 10) {
    await this.init();
    const rows = await this._query(
      this.kjvDb,
      'SELECT wordId, word, bookNum, chNum, verseNum FROM words WHERE word LIKE ? LIMIT ?',
      [`%${query}%`, limit]
    );

    return Promise.all(
      rows.map(r => this.getVerse({ bookNum: r.bookNum, chapter: r.chNum, verse: r.verseNum }))
    );
  }
}

module.exports = new BibleDatabaseService();
