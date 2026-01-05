import { Buffer } from 'buffer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
        return res.status(500).json({
            error: 'GitHub configuration missing. Please set GITHUB_TOKEN and GITHUB_REPO env vars.'
        });
    }

    try {
        const dbData = req.body;
        const content = JSON.stringify(dbData, null, 2);
        const filePath = 'data/db.json';
        const branch = GITHUB_BRANCH || 'main';
        const message = `[Admin] Update database via Portal (${new Date().toISOString()})`;

        // 1. Get current file SHA file to update it
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${branch}`, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getRes.ok) {
            // If file doesn't exist, we can't update. Or maybe create? 
            // Assuming it exists for now since we ingested it.
            const errText = await getRes.text();
            throw new Error(`Failed to get file SHA: ${errText}`);
        }

        const fileData = await getRes.json();
        const sha = fileData.sha;

        // 2. Update file
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message,
                content: Buffer.from(content).toString('base64'),
                sha,
                branch
            })
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            throw new Error(`Failed to update file: ${errText}`);
        }

        return res.status(200).json({
            success: true,
            message: 'Database saved to GitHub. Vercel deployment triggered.'
        });

    } catch (error) {
        console.error('Save API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
