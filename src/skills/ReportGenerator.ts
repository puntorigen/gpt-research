import { EventEmitter } from 'events';
import { Config } from '../core/Config';
import { Memory } from '../core/Memory';
import { 
  ResearchContext, 
  ReportType, 
  Tone, 
  ChatMessage,
  SearchResult 
} from '../types';
import { LLMProvider } from '../providers/LLMProvider';
import nunjucks from 'nunjucks';

export interface ReportSection {
  title: string;
  content: string;
  level: number; // Heading level (1-6)
}

export interface ReportTemplate {
  systemPrompt: string;
  userPrompt: string;
  sections?: string[];
  format?: string;
}

export class ReportGenerator extends EventEmitter {
  private config: Config;
  private memory: Memory;
  private templateEngine: nunjucks.Environment;
  private templates: Map<ReportType, ReportTemplate>;
  
  constructor(config: Config, memory: Memory) {
    super();
    this.config = config;
    this.memory = memory;
    
    // Initialize template engine
    this.templateEngine = nunjucks.configure({
      autoescape: false,
      trimBlocks: true,
      lstripBlocks: true
    });
    
    // Initialize report templates
    this.templates = new Map();
    this.initializeTemplates();
  }
  
  private initializeTemplates(): void {
    // Research Report Template
    this.templates.set(ReportType.ResearchReport, {
      systemPrompt: `You are a professional research analyst tasked with writing comprehensive research reports. 
Your reports should be well-structured, factual, and include proper citations.
Write in a clear, professional tone that is accessible to a general audience.
Structure your report with clear sections and subsections.`,
      userPrompt: `Write a comprehensive research report on: "{{query}}"

Based on the following research findings:
{{findings}}

Please create a detailed report that:
1. Provides a comprehensive overview of the topic
2. Analyzes key findings and insights
3. Discusses different perspectives or viewpoints
4. Includes relevant examples and evidence
5. Concludes with key takeaways and implications

Format the report with clear markdown headings and structure.`,
      sections: ['Introduction', 'Key Findings', 'Analysis', 'Conclusion', 'References']
    });
    
    // Detailed Report Template
    this.templates.set(ReportType.DetailedReport, {
      systemPrompt: `You are an expert researcher creating an in-depth, detailed analysis report.
Your report should be thorough, covering all aspects of the topic with extensive detail.
Include technical details where relevant and provide comprehensive coverage.`,
      userPrompt: `Create a detailed analytical report on: "{{query}}"

Research findings:
{{findings}}

Subtopics to cover:
{{subtopics}}

Please create an extensive report that:
1. Provides deep technical analysis
2. Explores all subtopics thoroughly
3. Includes detailed explanations and examples
4. Analyzes trends, patterns, and implications
5. Provides actionable insights and recommendations

Use detailed markdown formatting with multiple heading levels.`,
      sections: ['Executive Summary', 'Introduction', 'Methodology', 'Detailed Analysis', 'Findings', 'Recommendations', 'Conclusion']
    });
    
    // Quick Summary Template
    this.templates.set(ReportType.QuickSummary, {
      systemPrompt: `You are creating a concise summary of research findings.
Be brief but comprehensive, highlighting only the most important points.
Write in clear, simple language.`,
      userPrompt: `Provide a quick summary of: "{{query}}"

Key findings:
{{findings}}

Create a brief summary that:
1. Highlights the most important points
2. Provides key facts and figures
3. Summarizes main conclusions
4. Is easy to read and understand

Keep it concise - aim for 500 words or less.`,
      sections: ['Summary', 'Key Points', 'Conclusion']
    });
    
    // Resource Report Template
    this.templates.set(ReportType.ResourceReport, {
      systemPrompt: `You are creating a resource compilation report.
Focus on organizing and categorizing resources, tools, and references.
Provide brief descriptions for each resource.`,
      userPrompt: `Create a resource report for: "{{query}}"

Available resources:
{{findings}}

Compile a structured resource report that:
1. Categorizes resources by type or topic
2. Provides brief descriptions for each resource
3. Includes links and references
4. Highlights the most valuable resources
5. Suggests how to use these resources effectively

Format as a well-organized resource guide.`,
      sections: ['Overview', 'Primary Resources', 'Additional Resources', 'How to Use These Resources']
    });
    
    // Outline Report Template
    this.templates.set(ReportType.OutlineReport, {
      systemPrompt: `You are creating a structured outline based on research findings.
Focus on organization and hierarchy of information.
Create a detailed outline that could be expanded into a full report.`,
      userPrompt: `Create a detailed outline for: "{{query}}"

Research findings:
{{findings}}

Create a comprehensive outline that:
1. Organizes information hierarchically
2. Includes main topics and subtopics
3. Notes key points under each section
4. Suggests areas for further research
5. Provides a logical flow of information

Use proper outline formatting with multiple levels.`,
      sections: []
    });
  }
  
  /**
   * Generate a report based on the research context
   */
  async generateReport(
    context: ResearchContext,
    llmProvider: LLMProvider
  ): Promise<string> {
    this.emit('report_generation_start', { 
      query: context.query,
      reportType: context.reportType 
    });
    
    try {
      const reportType = context.reportType || ReportType.ResearchReport;
      const template = this.templates.get(reportType) || this.templates.get(ReportType.ResearchReport)!;
      
      // Prepare the context for the template
      const templateContext = this.prepareTemplateContext(context);
      
      // Render the prompts with the context
      const systemPrompt = this.applyTone(template.systemPrompt, this.config.get('tone'));
      const userPrompt = this.templateEngine.renderString(template.userPrompt, templateContext);
      
      // Create messages for LLM
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      // Generate the report
      const report = await llmProvider.createChatCompletion(messages, {
        model: this.config.get('smartLLMModel'),
        temperature: this.config.get('temperature') || 0.7,
        maxTokens: this.config.get('maxTokens') || 4000
      });
      
      // Post-process the report
      const processedReport = this.postProcessReport(report, context);
      
      // Store in memory
      this.memory.addReport(reportType, processedReport);
      
      this.emit('report_generation_complete', {
        query: context.query,
        reportType,
        length: processedReport.length
      });
      
      return processedReport;
      
    } catch (error) {
      this.emit('report_generation_error', { error });
      throw error;
    }
  }
  
  /**
   * Generate report with streaming
   */
  async *generateReportStream(
    context: ResearchContext,
    llmProvider: LLMProvider
  ): AsyncGenerator<string> {
    this.emit('report_stream_start', { 
      query: context.query,
      reportType: context.reportType 
    });
    
    try {
      const reportType = context.reportType || ReportType.ResearchReport;
      const template = this.templates.get(reportType) || this.templates.get(ReportType.ResearchReport)!;
      
      // Prepare the context for the template
      const templateContext = this.prepareTemplateContext(context);
      
      // Render the prompts with the context
      const systemPrompt = this.applyTone(template.systemPrompt, this.config.get('tone'));
      const userPrompt = this.templateEngine.renderString(template.userPrompt, templateContext);
      
      // Create messages for LLM
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      // Stream the report generation
      let fullReport = '';
      const stream = llmProvider.createChatCompletionStream(messages, {
        model: this.config.get('smartLLMModel'),
        temperature: this.config.get('temperature') || 0.7,
        maxTokens: this.config.get('maxTokens') || 4000
      });
      
      for await (const chunk of stream) {
        fullReport += chunk;
        yield chunk;
      }
      
      // Store the complete report in memory
      this.memory.addReport(reportType, fullReport);
      
      this.emit('report_stream_complete', {
        query: context.query,
        reportType,
        length: fullReport.length
      });
      
    } catch (error) {
      this.emit('report_stream_error', { error });
      throw error;
    }
  }
  
  /**
   * Prepare template context from research context
   */
  private prepareTemplateContext(context: ResearchContext): Record<string, any> {
    // Format findings for better readability
    const formattedFindings = context.findings
      .slice(0, 20) // Limit to top 20 findings
      .map((finding, index) => `${index + 1}. ${finding}`)
      .join('\n\n');
    
    // Format subtopics
    const formattedSubtopics = context.subtopics
      ? context.subtopics.map(topic => `- ${topic}`).join('\n')
      : '';
    
    // Format sources for citation
    const formattedSources = context.sources
      .slice(0, 20)
      .map((source, index) => `[${index + 1}] ${source.title} - ${source.url}`)
      .join('\n');
    
    return {
      query: context.query,
      findings: formattedFindings,
      subtopics: formattedSubtopics,
      sources: formattedSources,
      date: new Date().toLocaleDateString(),
      totalSources: context.sources.length
    };
  }
  
  /**
   * Apply tone modifications to the system prompt
   */
  private applyTone(systemPrompt: string, tone?: Tone): string {
    if (!tone) return systemPrompt;
    
    const toneModifiers: Record<Tone, string> = {
      [Tone.Objective]: '\nMaintain strict objectivity and neutrality. Present facts without bias.',
      [Tone.Formal]: '\nUse formal academic language and professional terminology.',
      [Tone.Academic]: '\nWrite in academic style with proper citations and scholarly language.',
      [Tone.Casual]: '\nUse conversational, friendly language that is easy to understand.',
      [Tone.Creative]: '\nBe creative and engaging in your writing style while maintaining accuracy.',
      [Tone.Analytical]: '\nFocus on deep analysis, patterns, and data-driven insights.',
      [Tone.Informative]: '\nPrioritize clarity and educational value in your explanations.',
      [Tone.Persuasive]: '\nPresent arguments convincingly while maintaining factual accuracy.',
      [Tone.Explanatory]: '\nExplain complex concepts in simple, understandable terms.',
      [Tone.Descriptive]: '\nProvide rich, detailed descriptions and vivid examples.',
      [Tone.Critical]: '\nApply critical thinking and evaluate sources and claims carefully.',
      [Tone.Enthusiastic]: '\nWrite with energy and enthusiasm while maintaining professionalism.',
      [Tone.Neutral]: '\nMaintain a balanced, neutral tone throughout.',
      [Tone.Professional]: '\nUse professional business language appropriate for corporate settings.',
      [Tone.Humorous]: '\nInclude appropriate humor and wit while maintaining informativeness.',
      [Tone.Empathetic]: '\nShow understanding and consideration for different perspectives.',
      [Tone.Authoritative]: '\nWrite with confidence and authority, demonstrating expertise.'
    };
    
    return systemPrompt + (toneModifiers[tone] || '');
  }
  
  /**
   * Post-process the generated report
   */
  private postProcessReport(report: string, context: ResearchContext): string {
    let processedReport = report;
    
    // Add title if not present
    if (!processedReport.startsWith('#')) {
      processedReport = `# ${context.query}\n\n${processedReport}`;
    }
    
    // Add metadata header
    const metadata = [
      `**Date:** ${new Date().toLocaleDateString()}`,
      `**Sources:** ${context.sources.length}`,
      `**Report Type:** ${context.reportType}`
    ].join(' | ');
    
    processedReport = `${processedReport.split('\n')[0]}\n\n${metadata}\n\n${processedReport.split('\n').slice(1).join('\n')}`;
    
    // Add references section if not present
    if (!processedReport.toLowerCase().includes('## references') && 
        !processedReport.toLowerCase().includes('## sources')) {
      processedReport += this.generateReferencesSection(context.sources);
    }
    
    // Clean up formatting
    processedReport = this.cleanFormatting(processedReport);
    
    return processedReport;
  }
  
  /**
   * Generate references section
   */
  private generateReferencesSection(sources: SearchResult[]): string {
    if (sources.length === 0) return '';
    
    let references = '\n\n## References\n\n';
    
    sources.slice(0, 20).forEach((source, index) => {
      references += `${index + 1}. [${source.title}](${source.url})`;
      if (source.publishedDate) {
        references += ` - ${new Date(source.publishedDate).toLocaleDateString()}`;
      }
      references += '\n';
    });
    
    return references;
  }
  
  /**
   * Clean up report formatting
   */
  private cleanFormatting(report: string): string {
    return report
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/^\s+|\s+$/g, '') // Trim whitespace
      .replace(/^- /gm, '• ') // Replace dashes with bullets
      .replace(/\*\*\*\*/g, '**') // Fix bold formatting
      .replace(/\[(\d+)\]\s*\[/g, '[$1] [') // Fix reference formatting
      .trim();
  }
  
  /**
   * Extract sections from a report
   */
  extractSections(report: string): ReportSection[] {
    const sections: ReportSection[] = [];
    const lines = report.split('\n');
    
    let currentSection: ReportSection | null = null;
    
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save current section if exists
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          title: headingMatch[2],
          content: '',
          level: headingMatch[1].length
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }
    
    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }
  
  /**
   * Generate table of contents for a report
   */
  generateTableOfContents(report: string): string {
    const sections = this.extractSections(report);
    let toc = '## Table of Contents\n\n';
    
    sections.forEach(section => {
      if (section.level <= 3) { // Only include h1, h2, h3
        const indent = '  '.repeat(section.level - 1);
        toc += `${indent}- ${section.title}\n`;
      }
    });
    
    return toc + '\n';
  }
  
  /**
   * Add custom template
   */
  addTemplate(reportType: ReportType, template: ReportTemplate): void {
    this.templates.set(reportType, template);
  }
  
  /**
   * Get available report types
   */
  getAvailableReportTypes(): ReportType[] {
    return Array.from(this.templates.keys());
  }
}
