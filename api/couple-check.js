import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const COUPLE_TABLE = "svq-couple-submissions";

// Returns how many submissions already exist for a couple code, without
// writing anything. Used by the front end to validate a code before the
// quiz starts.
//
// Response shape: { status: "available" | "joining" | "locked" }
//   available — no one has used this code yet
//   joining   — one partner has already submitted; this person would be the second
//   locked    — two submissions already exist; code is full

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { coupleCode } = req.body || {};
    const code = coupleCode?.trim();

    if (!code) {
      return res.status(400).json({ error: 'coupleCode required' });
    }

    const result = await ddb.send(new QueryCommand({
      TableName: COUPLE_TABLE,
      KeyConditionExpression: "coupleCode = :cc",
      ExpressionAttributeValues: { ":cc": code },
    }));

    const count = (result.Items || []).length;

    let status;
    if (count === 0) status = "available";
    else if (count === 1) status = "joining";
    else status = "locked";

    return res.status(200).json({ status });

  } catch (err) {
    console.error('Couple check error:', err);
    return res.status(500).json({ error: 'Could not check code', detail: err.message });
  }
}
