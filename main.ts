const POLICY_FILE_PATH = "./stripe-policy.txt";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = "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"; // Replace with your key.

// Function to call OpenAI's API
async function callOpenAI(messages: any[]): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Function to read the policy from file
async function readPolicy(): Promise<string> {
  return await Deno.readTextFile(POLICY_FILE_PATH);
}

// Function to parse the compliance policy into structured rules
async function extractComplianceRules(policy: string): Promise<any> {
  const prompt = [
    { role: "system", content: "You are a compliance policy analyzer." },
    {
      role: "user",
      content: `Given the following compliance policy, extract the rules into a JSON object with the structure:
{
  "prohibited_terms": ["term1", "term2", ...],
}
Here is the policy:\n\n${policy}`,
    },
  ];

  const result = await callOpenAI(prompt);
  return JSON.parse(result);
}

// Function to fetch and clean webpage content
async function fetchWebContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch webpage content.");
  }
  const html = await response.text();
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Function to check webpage compliance based on extracted rules
async function checkCompliance(
  rules: any,
  webpageContent: string
): Promise<string> {
  const prompt = [
    { role: "system", content: "You are a compliance checker." },
    {
      role: "user",
      content: `Check the following webpage content for compliance based on the rules below. Provide a detailed report of any violations and suggestions for improvement.\n\nRules:\n${JSON.stringify(
        rules
      )}\n\nWebpage Content:\n${webpageContent}`,
    },
  ];

  return await callOpenAI(prompt);
}

// Main API handler
async function handler(req: Request): Promise<Response> {
  try {
    const urlPath = new URL(req.url).pathname;

    // Ensure it's a POST request to "/validate"
    if (req.method === "POST" && urlPath === "/validate") {
      const { url } = await req.json();
      if (!url) {
        return new Response(JSON.stringify({ error: "URL is required." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Step 1: Read the policy
      const policy = await readPolicy();

      // Step 2: Extract compliance rules
      const complianceRules = await extractComplianceRules(policy);

      // Step 3: Fetch webpage content
      const webpageContent = await fetchWebContent(url);

      // Step 4: Check webpage compliance
      const complianceReport = await checkCompliance(
        complianceRules,
        webpageContent
      );

      // Step 5: Return the compliance report
      return new Response(
        JSON.stringify({ url, compliance_report: complianceReport }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Fallback for unsupported routes
    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Start server with Deno.serve
Deno.serve({ port: 8000 }, handler);

console.log("Server running at http://localhost:8000/");
