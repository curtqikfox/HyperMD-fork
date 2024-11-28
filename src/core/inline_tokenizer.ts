interface Token {
    type: string;
    value: string;
  }
  
  const inlineTokenizers = {
    escape: (text: string): Token[] => {
      return [{ type: "text", value: text.replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, "$1") }];
    },
  
    strong: (text: string): Token[] => {
      return text.split(/(\*\*([^*]+)\*\*)/g).map((part, index) => {
        if (index % 3 === 2) return { type: "strong", value: part };
        return { type: "text", value: part };
      });
    },
  
    emphasis: (text: string): Token[] => {
      return text.split(/(\*([^*]+)\*)/g).map((part, index) => {
        if (index % 3 === 2) return { type: "emphasis", value: part };
        return { type: "text", value: part };
      });
    },
  
    code: (text: string): Token[] => {
      return text.split(/(`([^`]+)`)/g).map((part, index) => {
        if (index % 3 === 2) return { type: "code", value: part };
        return { type: "text", value: part };
      });
    },
  
    deletion: (text: string): Token[] => {
      return text.split(/(~~([^~]+)~~)/g).map((part, index) => {
        if (index % 3 === 2) return { type: "deletion", value: part };
        return { type: "text", value: part };
      });
    },
  
    text: (text: string): Token[] => {
      return [{ type: "text", value: text }];
    },
  };
  

  export const tokenizeInline = (text: string): Token[] => {
    let tokens: Token[] = [{ type: "text", value: text }];
  
    // Apply each tokenizer in sequence
    tokens = tokens.flatMap(token => inlineTokenizers.escape(token.value));
    tokens = tokens.flatMap(token => inlineTokenizers.strong(token.value));
    tokens = tokens.flatMap(token => inlineTokenizers.emphasis(token.value));
    tokens = tokens.flatMap(token => inlineTokenizers.code(token.value));
    tokens = tokens.flatMap(token => inlineTokenizers.deletion(token.value));
  
    return tokens;
  };
  

  export const tokensToHtml = (tokens: Token[]): DocumentFragment => {
    const fragment = document.createDocumentFragment();
  
    tokens.forEach(token => {
      let el: HTMLElement | Text;
  
      switch (token.type) {
        case "strong":
          el = document.createElement("strong");
          el.textContent = token.value;
          break;
        case "emphasis":
          el = document.createElement("em");
          el.textContent = token.value;
          break;
        case "code":
          el = document.createElement("code");
          el.textContent = token.value;
          break;
        case "deletion":
          el = document.createElement("del");
          el.textContent = token.value;
          break;
        case "text":
        default:
          el = document.createTextNode(token.value);
      }
  
      fragment.appendChild(el);
    });
  
    return fragment;
  };
  