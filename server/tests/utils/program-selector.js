/**
 * Program Selector Utility
 * Selects test programs from the programs directory for load testing
 */

const fs = require('fs');
const path = require('path');

const PROGRAMS_DIR = path.join(__dirname, '../programs');

const LANGUAGES = ['python', 'javascript', 'java', 'cpp']; // SQL excluded due to MySQL container startup overhead

/**
 * Read all programs for a given language
 * @param {string} language - Language directory name
 * @returns {Array} Array of program objects
 */
function readProgramsForLanguage(language) {
    const langDir = path.join(PROGRAMS_DIR, language);
    
    if (!fs.existsSync(langDir)) {
        console.warn(`Warning: Directory ${langDir} does not exist`);
        return [];
    }
    
    const files = fs.readdirSync(langDir).filter(file => {
        const ext = getLanguageExtension(language);
        return file.endsWith(ext);
    });
    
    return files.map(file => {
        const filePath = path.join(langDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract complexity from filename (e.g., "01_simple_hello.py")
        const complexityMatch = file.match(/^(\d+)_(\w+)_/);
        const complexity = complexityMatch ? parseInt(complexityMatch[1]) : 1;
        const category = complexityMatch ? complexityMatch[2] : 'unknown';
        
        return {
            name: file,
            path: filePath,
            content,
            complexity,
            category,
            language
        };
    });
}

/**
 * Get file extension for a language
 * @param {string} language
 * @returns {string}
 */
function getLanguageExtension(language) {
    const extensions = {
        python: '.py',
        javascript: '.js',
        java: '.java',
        cpp: '.cpp',
        sql: '.sql'
    };
    return extensions[language] || '';
}

/**
 * Select programs using stratified strategy
 * Picks one simple (complexity 1-2) and one complex (complexity 5-6) per language
 * @returns {Object} Map of language to {simple, complex} programs
 */
function selectStratified() {
    const result = {};
    
    for (const language of LANGUAGES) {
        const programs = readProgramsForLanguage(language);
        
        if (programs.length === 0) {
            console.warn(`No programs found for ${language}`);
            continue;
        }
        
        // Separate into simple and complex
        const simple = programs.filter(p => p.complexity <= 2);
        const complex = programs.filter(p => p.complexity >= 5);
        
        // Randomly select one from each category
        const selectedSimple = simple.length > 0 
            ? simple[Math.floor(Math.random() * simple.length)]
            : programs[0];
            
        const selectedComplex = complex.length > 0
            ? complex[Math.floor(Math.random() * complex.length)]
            : programs[programs.length - 1];
        
        result[language] = {
            simple: selectedSimple,
            complex: selectedComplex
        };
    }
    
    return result;
}

/**
 * Select one random program per language
 * @returns {Object} Map of language to program
 */
function selectRandom() {
    const result = {};
    
    for (const language of LANGUAGES) {
        const programs = readProgramsForLanguage(language);
        
        if (programs.length === 0) {
            console.warn(`No programs found for ${language}`);
            continue;
        }
        
        const selected = programs[Math.floor(Math.random() * programs.length)];
        result[language] = selected;
    }
    
    return result;
}

/**
 * Select all programs for all languages
 * @returns {Object} Map of language to array of programs
 */
function selectAll() {
    const result = {};
    
    for (const language of LANGUAGES) {
        result[language] = readProgramsForLanguage(language);
    }
    
    return result;
}

/**
 * Main selection function
 * @param {string} strategy - 'stratified', 'random', or 'all'
 * @returns {Object} Selected programs
 */
function selectPrograms(strategy = 'stratified') {
    switch (strategy) {
        case 'stratified':
            return selectStratified();
        case 'random':
            return selectRandom();
        case 'all':
            return selectAll();
        default:
            throw new Error(`Unknown strategy: ${strategy}`);
    }
}

module.exports = {
    selectPrograms,
    selectStratified,
    selectRandom,
    selectAll,
    LANGUAGES
};
