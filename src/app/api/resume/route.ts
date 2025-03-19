import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Path to resume.json file
    const resumePath = path.join(process.cwd(), 'resume.json');
    
    // Check if file exists
    if (!fs.existsSync(resumePath)) {
      return NextResponse.json(
        { 
          error: 'Resume data not found',
          timestamp: new Date().toISOString() 
        },
        { status: 404 }
      );
    }
    
    // Read the file
    const resumeData = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    
    // Return the resume data
    return NextResponse.json({
      ...resumeData,
      _meta: {
        timestamp: new Date().toISOString(),
        source: 'resume.json'
      }
    });
  } catch (error) {
    console.error('Error fetching resume data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to load resume data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      },
      { status: 500 }
    );
  }
} 