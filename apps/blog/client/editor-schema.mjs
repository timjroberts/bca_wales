import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
export const imageDefaults = { version:1,assetId:'',policyVersion:1,sensitive:true,warning:'Sensitive landscape image',alt:'',decorative:false,caption:'',credit:'' };
export function extensions({ editComponent = () => {}, post = '' } = {}) {
  const ImageNode = Node.create({
    name:'image',group:'block',atom:true,draggable:true,selectable:true,
    addAttributes() { return Object.fromEntries(Object.entries(imageDefaults).map(([name,value])=>[name,{ default:value }])); },
    parseHTML() { return []; }, // Arbitrary pasted images never become valid private assets.
    renderHTML({ HTMLAttributes }) { return ['figure', { 'data-asset':HTMLAttributes.assetId }, 'Image']; },
    addNodeView() { return ({ node, getPos, editor }) => {
      const dom = document.createElement('figure'); dom.className = 'editor-image'; dom.contentEditable = 'false';
      const img = document.createElement('img'); img.src = `/preview/media/${post}/buffer/${node.attrs.assetId}/pixel`; img.alt = ''; img.className = 'pixelated';
      const action = document.createElement('button'); action.type = 'button'; action.textContent = 'Edit image';
      action.addEventListener('click',()=>{ editor.commands.setNodeSelection(getPos()); editComponent('image',node.attrs); }); dom.append(img,action); return { dom,stopEvent:event=>event.target === action };
    }; }
  });
  const Callout = Node.create({ name:'callout',group:'block',content:'inline*',defining:true,
    addAttributes() { return { version:{ default:1 },tone:{ default:'note' } }; },
    parseHTML() { return [{ tag:'aside[data-callout]' }]; },
    renderHTML({ HTMLAttributes }) { return ['aside',mergeAttributes({ 'data-callout':'true',class:`callout ${HTMLAttributes.tone}` }),0]; }
  });
  return [StarterKit.configure({ heading:{ levels:[2,3] },code:false,codeBlock:false,horizontalRule:false,strike:false,underline:false,link:false,trailingNode:false }),Link.configure({ openOnClick:false,autolink:false,linkOnPaste:false,protocols:['http','https'] }),ImageNode,Callout];
}
