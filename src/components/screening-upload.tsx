"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { uploadScreeningPDF, extractTextFromPDF, parseScreeningWithClaude, updateDealWithScreening } from "@/lib/screening";
import type { Deal } from "@/types/database";

interface ScreeningUploadProps {
  deal: Deal;
  onUpdate: () => void;
}

export function ScreeningUpload({ deal, onUpdate }: ScreeningUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Upload PDF to storage
      const pdfUrl = await uploadScreeningPDF(deal.id, file);

      // 2. Extract text from PDF (simplified - in production use proper PDF parser)
      let text: string;
      try {
        text = await extractTextFromPDF(file);
      } catch {
        // Fallback: use filename and basic info if text extraction fails
        text = `Target screening for ${deal.company_name}. File: ${file.name}`;
      }

      // 3. Parse with Claude
      const analysis = await parseScreeningWithClaude(text);

      // 4. Update deal in database
      await updateDealWithScreening(deal.id, analysis, pdfUrl);

      setSuccess(true);
      onUpdate(); // Refresh the deal data
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      // Clear the input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Target Screening
        </CardTitle>
        <CardDescription>
          Upload a target screening PDF to automatically extract thesis, missing data, and next steps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Screening document uploaded and analyzed successfully!
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors">
          <label className="cursor-pointer text-center">
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-semibold">Click to upload</span> a PDF screening document
              </div>
              <div className="text-xs text-gray-500">
                PDF files up to 10MB
              </div>
            </div>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        </div>

        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
            Processing document...
          </div>
        )}

        <div className="text-xs text-gray-500">
          The system will automatically extract:
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Investment thesis summary</li>
            <li>Why Own It? (competitive advantages)</li>
            <li>Why Now? (timing catalysts)</li>
            <li>Exit Story (potential exits)</li>
            <li>Missing data points</li>
            <li>Recommended next steps</li>
            <li>Deal score (0-100)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}