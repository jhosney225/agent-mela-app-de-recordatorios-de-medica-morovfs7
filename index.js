
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as readline from "readline";

const client = new Anthropic();

// In-memory database for medications
let medications = [];
let conversationHistory = [];

const medicationSystemPrompt = `You are a helpful medication reminder assistant. You help users:
1. Add medications with their dosage, frequency, and time
2. Set up reminders for medications
3. List all current medications
4. Remove medications
5. Get medication information and advice

When users ask about medications, help them organize their medication schedule. 
For each medication, track: name, dosage, frequency (daily/weekly/etc), time of day, and purpose.

When asked to add a medication, extract: medication name, dosage amount and unit, frequency, time of day, and purpose if mentioned.
Format responses clearly with medication details.

If a user asks about medication interactions or health advice, remind them to consult a healthcare provider.
Be supportive and help them stay on top of their medication schedule.`;

async function chat(userMessage) {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 8096,
    system: medicationSystemPrompt,
    messages: conversationHistory,
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  // Parse the response to handle medication-related commands
  await handleMedicationCommands(userMessage, assistantMessage);

  return assistantMessage;
}

async function handleMedicationCommands(userMessage, response) {
  const lowerMessage = userMessage.toLowerCase();

  // Extract medication details if user is adding a medication
  if (
    lowerMessage.includes("add") ||
    lowerMessage.includes("take") ||
    lowerMessage.includes("reminder")
  ) {
    // Simple extraction of medication details from context
    const medicationMatch = userMessage.match(
      /(?:add|take|remind me about)\s+(.+?)(?:\s+for|\s+at|\s+\d+|$)/i
    );
    if (medicationMatch && !lowerMessage.includes("list")) {
      const medicationName = medicationMatch[1].trim();

      // Extract dosage
      const dosageMatch = userMessage.match(/(\d+)\s*(mg|ml|tablet|pill|capsule)/i);
      const dosage = dosageMatch ? dosageMatch[0] : "1 dose";

      // Extract frequency
      let frequency = "daily";
      if (lowerMessage.includes("twice")) frequency = "twice daily";
      else if (lowerMessage.includes("three times")) frequency = "three times daily";
      else if (lowerMessage.includes("every 12")) frequency = "every 12 hours";
      else if (lowerMessage.includes("every 8")) frequency = "every 8 hours";
      else if (lowerMessage.includes("weekly")) frequency = "weekly";

      // Extract time
      const timeMatch = userMessage.match(/at\s+(\d+:\d+\s*(?:am|pm)?)/i);
      const time = timeMatch ? timeMatch[1] : "morning";

      const medication = {
        id: Date.now(),
        name: medicationName,
        dosage: dosage,
        frequency: frequency,
        time: time,
        addedDate: new Date().toISOString(),
      };

      // Check if medication already exists
      if (!medications.some((m) => m.name.toLowerCase() === medicationName.toLowerCase())) {
        medications.push(medication);
        console.log(`\n✓ Medication "${medicationName}" added to your reminder list`);
      }
    }
  }

  // Handle list command
  if (lowerMessage.includes("list") || lowerMessage.includes("show")) {
    if (medications.length > 0) {
      console.log("\n📋 Current Medications:");
      medications.forEach((med, index) => {
        console.log(
          `${index + 1}. ${med.name} - ${med.dosage}, ${med.frequency} at ${med.time}`
        );
      });
    }
  }

  // Handle remove command
  if (lowerMessage.includes("remove") || lowerMessage.includes("delete")) {
    const removeMatch = userMessage.match(
      /(?:remove|delete|stop)\s+(?:the\s+)?(.+?)(?:\s+from|$)/i
    );
    if (removeMatch) {
      const nameToRemove = removeMatch[1].trim().toLowerCase();
      const initialLength = medications.length;
      medications = medications.filter(
        (m) => !m.name.toLowerCase().includes(nameToRemove)
      );
      if (medications.length < initialLength) {
        console.log(`\n✓ Medication(s) removed from your reminder list`);
      }
    }
  }
}

async function getNextReminders() {
  if (medications.length === 0) {
    return "No medications scheduled. Add some to get started!";
  }

  const now = new Date();
  const upcomingReminders = medications.map((med) => {
    return `💊 ${med.name} (${med.dosage}) - ${med.frequency} at ${med.time}`;
  });

  return "📌 Your Medication Schedule:\n" + upcomingReminders.join("\n");
}

async function startInteractiveSession() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🏥 Medication Reminder Assistant");
  console.log("=====================================");
  console.log("I'm here to help you manage your medication reminders.");
  console.log("You can:");
  