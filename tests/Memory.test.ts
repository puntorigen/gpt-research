import { describe, it, expect, beforeEach } from 'vitest';
import { Memory } from '../src/core/Memory';
import type { SearchResult } from '../src/types';

describe('Memory', () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
  });

  describe('Generic memory operations', () => {
    it('should add and retrieve memory entries', () => {
      const id = memory.add('context', 'test content', { key: 'value' });
      const entry = memory.get(id);
      
      expect(entry).toBeDefined();
      expect(entry?.type).toBe('context');
      expect(entry?.content).toBe('test content');
      expect(entry?.metadata).toEqual({ key: 'value' });
    });

    it('should get entries by type', () => {
      memory.add('search', 'search1');
      memory.add('context', 'context1');
      memory.add('search', 'search2');
      
      const searchEntries = memory.getByType('search');
      const contextEntries = memory.getByType('context');
      
      expect(searchEntries).toHaveLength(2);
      expect(contextEntries).toHaveLength(1);
    });

    it('should clear all memory', () => {
      memory.add('context', 'test');
      memory.addSearchResults('query', []);
      memory.addSubtopic('topic');
      
      memory.clear();
      
      expect(memory.getStats().totalEntries).toBe(0);
      expect(memory.getSearchResults()).toHaveLength(0);
      expect(memory.getSubtopics()).toHaveLength(0);
    });
  });

  describe('Search results management', () => {
    const mockResults: SearchResult[] = [
      { url: 'http://example.com/1', title: 'Result 1', content: 'Content 1' },
      { url: 'http://example.com/2', title: 'Result 2', content: 'Content 2' },
    ];

    it('should add and retrieve search results', () => {
      memory.addSearchResults('test query', mockResults);
      
      const results = memory.getSearchResults('test query');
      expect(results).toEqual(mockResults);
    });

    it('should mark URLs as visited when adding search results', () => {
      memory.addSearchResults('query', mockResults);
      
      expect(memory.isUrlVisited('http://example.com/1')).toBe(true);
      expect(memory.isUrlVisited('http://example.com/2')).toBe(true);
      expect(memory.isUrlVisited('http://example.com/3')).toBe(false);
    });

    it('should get all search results when no query specified', () => {
      memory.addSearchResults('query1', [mockResults[0]]);
      memory.addSearchResults('query2', [mockResults[1]]);
      
      const allResults = memory.getSearchResults();
      expect(allResults).toHaveLength(2);
    });
  });

  describe('Scraped content management', () => {
    it('should add and retrieve scraped content', () => {
      memory.addScrapedContent('http://example.com', 'Scraped content');
      
      const content = memory.getScrapedContent('http://example.com');
      expect(content).toBe('Scraped content');
    });

    it('should mark URL as visited when adding scraped content', () => {
      memory.addScrapedContent('http://example.com', 'content');
      
      expect(memory.isUrlVisited('http://example.com')).toBe(true);
    });

    it('should get all scraped content', () => {
      memory.addScrapedContent('url1', 'content1');
      memory.addScrapedContent('url2', 'content2');
      
      const allContent = memory.getAllScrapedContent();
      expect(allContent.size).toBe(2);
      expect(allContent.get('url1')).toBe('content1');
    });
  });

  describe('Context management', () => {
    it('should add and retrieve context', () => {
      memory.addContext('Context 1');
      memory.addContext('Context 2');
      
      const context = memory.getContext();
      expect(context).toEqual(['Context 1', 'Context 2']);
    });

    it('should clear context', () => {
      memory.addContext('Context');
      memory.clearContext();
      
      expect(memory.getContext()).toEqual([]);
    });
  });

  describe('Subtopics management', () => {
    it('should add unique subtopics', () => {
      memory.addSubtopic('Topic 1');
      memory.addSubtopic('Topic 2');
      memory.addSubtopic('Topic 1'); // Duplicate
      
      const subtopics = memory.getSubtopics();
      expect(subtopics).toEqual(['Topic 1', 'Topic 2']);
    });
  });

  describe('Report management', () => {
    it('should add and retrieve reports', () => {
      memory.addReport('final', 'Final report content');
      memory.addReport('summary', 'Summary content');
      
      expect(memory.getReport('final')).toBe('Final report content');
      expect(memory.getReport('summary')).toBe('Summary content');
    });

    it('should get all reports', () => {
      memory.addReport('type1', 'content1');
      memory.addReport('type2', 'content2');
      
      const allReports = memory.getAllReports();
      expect(allReports.size).toBe(2);
    });
  });

  describe('Statistics and export', () => {
    it('should provide memory statistics', () => {
      memory.addSearchResults('query', [
        { url: 'url1', title: 'Title', content: 'Content' }
      ]);
      memory.addContext('context');
      memory.addSubtopic('topic');
      
      const stats = memory.getStats();
      
      expect(stats.searchQueries).toBe(1);
      expect(stats.searchResults).toBe(1);
      expect(stats.contextItems).toBe(1);
      expect(stats.subtopics).toBe(1);
    });

    it('should export and import memory', () => {
      memory.addContext('Test context');
      memory.addSubtopic('Test topic');
      memory.addSearchResults('query', [
        { url: 'test.com', title: 'Test', content: 'Content' }
      ]);
      
      const exported = memory.export();
      
      const newMemory = new Memory();
      newMemory.import(exported);
      
      expect(newMemory.getContext()).toEqual(['Test context']);
      expect(newMemory.getSubtopics()).toEqual(['Test topic']);
      expect(newMemory.getSearchResults('query')).toHaveLength(1);
    });

    it('should handle invalid import data', () => {
      expect(() => memory.import('invalid json')).toThrow();
    });
  });
});
