import cors from 'cors';
import express, { Request, Response } from 'express';

import {
  deepResearch,
  writeFinalAnswer,
  writeFinalReport,
} from './deep-research';
import { generateFeedback } from './feedback';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const {
      query,
      depth = 3,
      breadth = 3,
      follow_up_questions = [],
      follow_up_answers = [],
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (follow_up_questions.length == 0) {
      const followUpQuestions = await generateFeedback({
        query: query,
      });

      return res.json({
        follow_up_questions: followUpQuestions,
      });
    }

    let combinedQuery = query;
    let isReport = false;
    if (follow_up_questions) {
      if (follow_up_questions.length != follow_up_answers.length) {
        return res
          .status(400)
          .json({ error: 'Missing Follow Up Answers (follow_up_answers)' });
      }
      isReport = true;
      combinedQuery = `
Initial Query: ${query}
Follow-up Questions and Answers:
${follow_up_questions.map((q: string, i: number) => `Q: ${q}\nA: ${follow_up_answers[i]}`).join('\n')}
`;
    }

    log('\nStarting research...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );

    if (isReport) {
      const report = await writeFinalReport({
        prompt: combinedQuery,
        learnings,
        visitedUrls,
      });
      return res.json({
        success: true,
        report,
      });
    } else {
      const answer = await writeFinalAnswer({
        prompt: query,
        learnings,
      });
      return res.json({
        success: true,
        answer,
        learnings,
        visitedUrls,
      });
    }
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
