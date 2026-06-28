import { useEffect, useRef } from 'react'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default function MarkdownRenderer({ content }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !content) return

    try {
      let processedContent = content

      // 1. Math formulas
      processedContent = processedContent.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        try {
          const html = katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false, trust: true, strict: false })
          return `<div class="math-block my-4 p-3 bg-black/20 rounded-lg border border-white/10 overflow-x-auto">${html}</div>`
        } catch (e) { return match }
      })

      processedContent = processedContent.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
        try {
          const html = katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false, trust: true, strict: false })
          return `<span class="math-inline mx-1">${html}</span>`
        } catch (e) { return match }
      })

      // 2. Code blocks
      let codeBlockIndex = 0
      const codeBlockPlaceholders = []
      
      // Standard format - 使用否定前瞻确保 ```后面不是字母
      processedContent = processedContent.replace(/```(\w+)?\n([\s\S]+?)```(?!\w)/g, (match, language, code) => {
        const lang = language || 'code'
        const escapedCode = escapeHtml(code.trim())
        const index = codeBlockIndex++
        const placeholder = `___CODE_BLOCK_${index}___`
        codeBlockPlaceholders[index] = `<div class="code-block-wrapper my-2 rounded-md overflow-hidden border border-white/10 max-w-3xl"><div class="relative bg-black/40 px-3 py-1.5 border-b border-white/10"><span class="text-xs text-white/50">${lang}</span><button onclick="copyCode${index}()" class="absolute top-1.5 right-2 text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors"><span id="copy-btn-${index}">Copy</span></button></div><pre class="bg-black/30 p-3 overflow-x-auto"><code id="code-${index}" class="text-sm text-emerald-400 font-mono drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]  whitespace-pre-wrap leading-relaxed">${escapedCode}</code></pre></div>`
        return placeholder
      })
      
      // Compact format - 使用否定前瞻确保 ```后面不是字母
      processedContent = processedContent.replace(/```(\w+)([^`]+?)```(?!\w)/g, (match, language, code) => {
        const lang = language || 'code'
        const escapedCode = escapeHtml(code.trim())
        const index = codeBlockIndex++
        const placeholder = `___CODE_BLOCK_${index}___`
        codeBlockPlaceholders[index] = `<div class="code-block-wrapper my-2 rounded-md overflow-hidden border border-white/10 max-w-3xl"><div class="relative bg-black/40 px-3 py-1.5 border-b border-white/10"><span class="text-xs text-white/50">${lang}</span><button onclick="copyCode${index}()" class="absolute top-1.5 right-2 text-xs px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors"><span id="copy-btn-${index}">Copy</span></button></div><pre class="bg-black/30 p-3 overflow-x-auto"><code id="code-${index}" class="text-sm text-emerald-400 font-mono drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]  whitespace-pre-wrap leading-relaxed">${escapedCode}</code></pre></div>`
        return placeholder
      })
      
      // Streaming: unclosed code block
      processedContent = processedContent.replace(/```(\w+)?\n?([\s\S]*)$/g, (match, language, code) => {
        if (match.includes('___CODE_BLOCK_')) return match
        const lang = language || 'code'
        const escapedCode = escapeHtml(code)
        const index = codeBlockIndex++
        const placeholder = `___CODE_BLOCK_${index}___`
        codeBlockPlaceholders[index] = `<div class="code-block-wrapper my-2 rounded-md overflow-hidden border border-white/10 max-w-3xl"><div class="relative bg-black/40 px-3 py-1.5 border-b border-white/10"><span class="text-xs text-white/50">${lang}</span><span class="absolute top-1.5 right-2 text-xs text-white/40 flex items-center gap-1"><span class="w-1.5 h-1.5 bg-white/50 rounded-full animate-pulse"></span>typing...</span></div><pre class="bg-black/30 p-3 overflow-x-auto"><code class="text-sm text-emerald-400 font-mono drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]  whitespace-pre-wrap leading-relaxed">${escapedCode}</code></pre></div>`
        return placeholder
      })

      // 3. Tables
      let tableIndex = 0
      const tablePlaceholders = []
      processedContent = processedContent.replace(/^(\|.+\|\s*\n)(\|[-:| ]+\|\s*\n)((\|.+\|\s*\n?)+)/gm, (match, header, separator, body) => {
        const index = tableIndex++
        const placeholder = `___TABLE_${index}___`
        const headers = header.trim().split('|').filter(h => h.trim()).map(h => h.trim())
        const rows = body.trim().split('\n').map(row => row.trim().split('|').filter(cell => cell !== '').map(cell => cell.trim()))
        let tableHtml = `<div class="relative my-3"><div class="absolute -top-8 right-0 z-10"><button onclick="copyTable${index}()" class="text-xs px-2 py-1 rounded bg-black/40 hover:bg-black/60 text-white/70 hover:text-white/90 border border-white/20 transition-all"><span id="copy-table-btn-${index}">Copy</span></button></div><div class="overflow-x-auto rounded-lg border border-white/10"><table id="table-${index}" class="min-w-full bg-black/20 backdrop-blur-sm"><thead class="bg-white/5"><tr>`
        headers.forEach(h => { tableHtml += `<th class="px-4 py-2 text-left text-xs font-semibold text-[#2E8B57] border-b border-white/10" style="text-shadow: 0 0 3px rgba(52,211,153,0.5)">${h}</th>` })
        tableHtml += `</tr></thead><tbody>`
        rows.forEach(row => { tableHtml += '<tr class="hover:bg-white/10 transition-colors">'; row.forEach(cell => { tableHtml += `<td class="px-4 py-2 text-xs text-[#2E8B57] border-b border-white/10" style="text-shadow: 0 0 3px rgba(52,211,153,0.5)">${cell}</td>` }); tableHtml += '</tr>' })
        tableHtml += `</tbody></table></div></div>`
        tablePlaceholders[index] = tableHtml
        return placeholder
      })

      // 4-12. Other Markdown
      processedContent = processedContent.replace(/`([^`]+?)`/g, (m, c) => `<code class="bg-white/10 px-2 py-0.5 rounded text-sm text-emerald-300 font-mono">${escapeHtml(c)}</code>`)
      processedContent = processedContent.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-400/50 pl-4 py-2 my-3 bg-blue-500/5 text-white/70 italic">$1</blockquote>')
      processedContent = processedContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:text-blue-300 underline transition-colors">$1</a>')
      processedContent = processedContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg my-3 border border-white/10" />')
      processedContent = processedContent.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      processedContent = processedContent.replace(/\*(.+?)\*/g, '<em class="italic text-white/90">$1</em>')
      processedContent = processedContent.replace(/^---$/gm, '<hr class="my-4 border-t border-white/20"/>')
      processedContent = processedContent.replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-2 text-white/90">$1</h4>')
      processedContent = processedContent.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-white/95">$1</h3>')
      processedContent = processedContent.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-5 mb-3 text-white">$1</h2>')
      processedContent = processedContent.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3 text-white">$1</h1>')
      processedContent = processedContent.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 mb-1 text-white/85 list-decimal">$2</li>')
      processedContent = processedContent.replace(/^- (.+)$/gm, '<li class="ml-6 mb-1 text-white/85 list-disc">$1</li>')
      processedContent = processedContent.replace(/\n\n/g, '<br/><br/>')
      processedContent = processedContent.replace(/\n/g, '<br/>')
      
      tablePlaceholders.forEach((html, index) => { processedContent = processedContent.replace(`___TABLE_${index}___`, html) })
      codeBlockPlaceholders.forEach((html, index) => { processedContent = processedContent.replace(`___CODE_BLOCK_${index}___`, html) })

      containerRef.current.innerHTML = DOMPurify.sanitize(processedContent)
      
      for (let i = 0; i < codeBlockIndex; i++) {
        window[`copyCode${i}`] = () => {
          const el = document.getElementById(`code-${i}`)
          if (el) { navigator.clipboard.writeText(el.textContent); const btn = document.getElementById(`copy-btn-${i}`); if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy' }, 2000) } }
        }
      }
      
      for (let i = 0; i < tableIndex; i++) {
        window[`copyTable${i}`] = () => {
          const el = document.getElementById(`table-${i}`)
          if (el) { let txt = ''; el.querySelectorAll('tr').forEach(r => { txt += Array.from(r.querySelectorAll('th, td')).map(c => c.textContent.trim()).join('\t') + '\n' }); navigator.clipboard.writeText(txt.trim()); const btn = document.getElementById(`copy-table-btn-${i}`); if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy' }, 2000) } }
        }
      }
    } catch (error) {
      console.error('Markdown rendering error:', error)
      containerRef.current.textContent = content
    }
  }, [content])

  return <div ref={containerRef} className="markdown-content" />
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}