#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ANSI color codes for terminal output
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m'; // No Color

const createKeyPair = async () => {
    // Use Node.js crypto to generate Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    
    // Export in different formats
    const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' });
    const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' });
    
    // Get raw key data for base64 encoding
    const privateKeyDer = privateKey.export({ format: 'der', type: 'pkcs8' });
    const publicKeyDer = publicKey.export({ format: 'der', type: 'spki' });
    
    // For Beckn compatibility, we need the raw 32-byte keys
    // Extract the 32-byte seed from the DER format (last 32 bytes for Ed25519)
    const privateKeySeed = privateKeyDer.slice(-32);
    const publicKeyRaw = publicKeyDer.slice(-32);
    
    // Convert to base64 for display
    const privateKey_base64 = privateKeySeed.toString('base64');
    const publicKey_base64 = publicKeyRaw.toString('base64');

    return {
        privateKey: privateKey_base64,
        publicKey: publicKey_base64,
        privateKeyPem,
        publicKeyPem,
        privateKeyRaw: privateKeySeed,
        publicKeyRaw: publicKeyRaw
    };
};

const saveKeysToFiles = (keyData) => {
    const keysDir = path.join(__dirname, 'keys');
    
    // Create keys directory if it doesn't exist
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
        console.log(`${GREEN}Created keys directory: ${keysDir}${NC}`);
    }

    try {
        // Save private key in PEM format
        fs.writeFileSync(path.join(keysDir, 'private_key.pem'), keyData.privateKeyPem);
        console.log(`${GREEN}✅ Private key saved to keys/private_key.pem${NC}`);

        // Save public key in PEM format
        fs.writeFileSync(path.join(keysDir, 'public_key.pem'), keyData.publicKeyPem);
        console.log(`${GREEN}✅ Public key saved to keys/public_key.pem${NC}`);

        // Save public key in base64 format
        fs.writeFileSync(path.join(keysDir, 'public_key.b64'), keyData.publicKey);
        console.log(`${GREEN}✅ Public key (base64) saved to keys/public_key.b64${NC}`);

        return true;
    } catch (error) {
        console.error(`${RED}❌ Error saving keys to files: ${error.message}${NC}`);
        return false;
    }
};

const main = async () => {
    try {
        console.log(`${YELLOW}🔑 Generating Ed25519 Key Pairs...${NC}`);
        
        const keyData = await createKeyPair();
        
        console.log(`${GREEN}\n✅ Key Pairs Generated Successfully!\n${NC}`);

        // Display keys
        console.log(`${YELLOW}Your Public Key:${NC}`);
        console.log(keyData.publicKey);
        console.log(`\n${YELLOW}Your Private Key:${NC}`);
        console.log(keyData.privateKey);

        // Save keys to files
        console.log(`\n${YELLOW}💾 Saving keys to files...${NC}`);
        const saved = saveKeysToFiles(keyData);

        if (saved) {
            console.log(`\n${GREEN}🔒 Keys have been saved securely in the 'keys' directory.${NC}`);
            console.log(`${YELLOW}⚠️  Please backup these keys in a secure location!${NC}`);
            console.log(`${YELLOW}⚠️  Never share your private key with anyone!${NC}`);
        } else {
            console.log(`\n${RED}❌ Failed to save keys to files. Please save them manually.${NC}`);
        }

    } catch (error) {
        console.error(`${RED}❌ Error generating keys: ${error.message}${NC}`);
        process.exit(1);
    }
};

// Export functions for potential use as a module
module.exports = {
    createKeyPair,
    saveKeysToFiles
};

// Run main function if this file is executed directly
if (require.main === module) {
    main();
}
