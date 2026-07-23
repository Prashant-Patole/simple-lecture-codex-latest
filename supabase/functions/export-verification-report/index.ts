import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, format } = await req.json();

    if (!documentId || !format) {
      return new Response(
        JSON.stringify({ error: 'documentId and format are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['csv', 'pdf'].includes(format)) {
      return new Response(
        JSON.stringify({ error: 'format must be csv or pdf' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch document with all details
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_question_documents')
      .select(`
        *,
        categories(name),
        popular_subjects(name),
        subject_chapters(title),
        subject_topics(title),
        subtopics(title),
        profiles(full_name)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Fetch all questions for this document
    const { data: questions, error: questionsError } = await supabaseClient
      .from('parsed_questions_pending')
      .select('*')
      .eq('document_id', documentId);

    if (questionsError) throw questionsError;

    // Calculate metrics
    const totalQuestions = questions?.length || 0;
    const verifiedQuestions = questions?.filter(q => q.llm_verified).length || 0;
    const approvedQuestions = questions?.filter(q => q.is_approved).length || 0;
    const avgConfidence = questions?.reduce((sum, q) => sum + (q.llm_confidence_score || 0), 0) / totalQuestions || 0;
    const qualityScore = document.verification_quality_score || (avgConfidence * (approvedQuestions / totalQuestions));

    if (format === 'csv') {
      // Generate CSV
      const headers = 'Question #,Question Text,Type,Difficulty,LLM Verified,LLM Confidence,Is Approved,Chapter,Topic,Subtopic\n';
      const rows = questions?.map((q, index) => {
        const questionText = (q.question_text || '').replace(/"/g, '""').substring(0, 100);
        return `${index + 1},"${questionText}",${q.question_format},${q.difficulty},${q.llm_verified},${q.llm_confidence_score || 0},${q.is_approved},"${q.chapter_id || ''}","${q.topic_id || ''}","${q.subtopic_id || ''}"`;
      }).join('\n') || '';

      const csv = headers + rows;

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="verification-report-${documentId}.csv"`
        }
      });
    } else {
      // Generate HTML for PDF conversion (client-side)
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
    .metric { background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 3px; }
    .metric-label { font-size: 12px; color: #666; }
    .metric-value { font-size: 24px; font-weight: bold; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background-color: #f5f5f5; font-weight: bold; }
    .quality-score { font-size: 36px; font-weight: bold; color: ${qualityScore >= 0.86 ? '#2563eb' : qualityScore >= 0.71 ? '#16a34a' : qualityScore >= 0.41 ? '#eab308' : '#dc2626'}; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Document Verification Report</h1>
    <p><strong>Document:</strong> ${document.questions_file_name || document.file_name}</p>
    <p><strong>Subject:</strong> ${document.popular_subjects?.name} > ${document.subject_chapters?.title} > ${document.subject_topics?.title || ''}</p>
    <p><strong>Uploaded:</strong> ${new Date(document.created_at).toLocaleDateString()}</p>
    <p><strong>Verified By:</strong> ${document.profiles?.full_name || 'Not yet verified'}</p>
    ${document.human_verified_at ? `<p><strong>Verified At:</strong> ${new Date(document.human_verified_at).toLocaleString()}</p>` : ''}
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Total Questions</div>
      <div class="metric-value">${totalQuestions}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Verified by LLM</div>
      <div class="metric-value">${verifiedQuestions}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Approved by Human</div>
      <div class="metric-value">${approvedQuestions}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Quality Score</div>
      <div class="quality-score">${(qualityScore * 100).toFixed(1)}%</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Question Text (Preview)</th>
        <th>Type</th>
        <th>Difficulty</th>
        <th>LLM Verified</th>
        <th>Confidence</th>
        <th>Approved</th>
      </tr>
    </thead>
    <tbody>
      ${questions?.map((q, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${(q.question_text || '').substring(0, 80)}...</td>
          <td>${q.question_format}</td>
          <td>${q.difficulty}</td>
          <td>${q.llm_verified ? '✅' : '❌'}</td>
          <td>${((q.llm_confidence_score || 0) * 100).toFixed(0)}%</td>
          <td>${q.is_approved ? '✅' : '⏳'}</td>
        </tr>
      `).join('') || '<tr><td colspan="7">No questions found</td></tr>'}
    </tbody>
  </table>
</body>
</html>
      `;

      return new Response(
        JSON.stringify({ html }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in export-verification-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
