const fs = require('fs');
const readline = require('readline');

const logPath = 'C:/Users/SIPL4129/.gemini/antigravity/brain/98ba7095-6283-4f31-bf2e-5234b9c813de/.system_generated/logs/transcript.jsonl';

async function processLineByLine() {
  const fileStream = fs.createReadStream(logPath);

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let step = 0;
  for await (const line of rl) {
    step++;
    try {
      const data = JSON.parse(line);
      if (data.type === 'PLANNER_RESPONSE' && data.tool_calls) {
        for (const call of data.tool_calls) {
          if ((call.name === 'write_to_file' || call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') && 
              call.args && call.args.TargetFile && call.args.TargetFile.includes('AnimalWorkspace.tsx')) {
            console.log(`Found edit at step ${step}, type ${call.name}`);
            if (call.name === 'write_to_file') {
               fs.writeFileSync(`extracted_animal_workspace_${step}.tsx`, call.args.CodeContent || call.args.Content || '');
            } else if (call.name === 'replace_file_content') {
               fs.writeFileSync(`extracted_animal_workspace_${step}_edit.json`, JSON.stringify(call.args, null, 2));
            } else if (call.name === 'multi_replace_file_content') {
               fs.writeFileSync(`extracted_animal_workspace_${step}_multi_edit.json`, JSON.stringify(call.args, null, 2));
            }
          }
        }
      }
    } catch (e) {
      if (line.includes('AnimalWorkspace.tsx')) {
         console.log(`Failed to parse step ${step}, but it contains AnimalWorkspace.tsx: ${e.message}`);
         fs.writeFileSync(`failed_parse_step_${step}.txt`, line);
      }
    }
  }
}

processLineByLine();
