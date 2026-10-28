
document.addEventListener("DOMContentLoaded", () => {
    const sourceCode = document.getElementById("sourceCode");
    const lineNumbers = document.getElementById("lineNumbers");
    const lineCount = document.getElementById("lineCount");
    const editorInfo = document.getElementById("editorInfo");

    const compileBtn = document.getElementById("compileBtn");
    const clearBtn = document.getElementById("clearBtn");
    const copyBtn = document.getElementById("copyBtn");
    const copyOutputBtn = document.getElementById("copyOutputBtn");

    const exampleSelect = document.getElementById("exampleSelect");
    const output = document.getElementById("output");
    const status = document.getElementById("status");
    const resultMessage = document.getElementById("resultMessage");

    const symbolTable = document.getElementById("symbolTable");
    const syntaxTree = document.getElementById("syntaxTree");

    const examples = {
        valid: "int marks[5];\nfloat prices[3];\nchar letters[10];",
        bounds: "int marks[0];",
        syntax: "int marks[5]",
        invalid: "int marks[5]@;"
    };

    const declarationPattern =
        /^\s*(int|float|char|double)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d+)\s*\]\s*;\s*$/;

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);
    }

    function updateEditorInfo() {
        const count = sourceCode.value.split("\n").length;

        lineNumbers.textContent = Array.from(
            { length: count },
            (_, index) => index + 1
        ).join("\n");

        lineCount.textContent =
            `${count} ${count === 1 ? "line" : "lines"}`;

        editorInfo.textContent = `${sourceCode.value.length} characters`;
    }

    function resetPipeline() {
        [
            "lexicalStep",
            "syntaxStep",
            "semanticStep",
            "resultStep"
        ].forEach(id => {
            const step = document.getElementById(id);
            step.classList.remove("done", "failed");
            step.querySelector(".stage-status").textContent = "Waiting";
        });
    }

    function setStage(id, state, message) {
        const step = document.getElementById(id);

        step.classList.remove("done", "failed");

        if (state) {
            step.classList.add(state);
        }

        step.querySelector(".stage-status").textContent = message;
    }

    function setResult(success, message) {
        status.textContent = success ? "Success" : "Failed";
        status.className =
            `result-badge ${success ? "success" : "error"}`;
        resultMessage.textContent = message;
    }

    function clearResults() {
        output.textContent = "Compiler output will appear here...";

        symbolTable.innerHTML = `
            <tr>
                <td colspan="3" class="empty-cell">
                    Compile code to view symbols.
                </td>
            </tr>
        `;

        syntaxTree.innerHTML = `
            <p class="tree-message">
                Compile your code to view the syntax tree.
            </p>
        `;

        resetPipeline();

        status.textContent = "Ready";
        status.className = "result-badge";
        resultMessage.textContent =
            "Enter your code and click Compile Code.";
    }

    function renderSymbolTable(symbols) {
        if (symbols.length === 0) {
            symbolTable.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-cell">
                        No valid array symbols found.
                    </td>
                </tr>
            `;
            return;
        }

        symbolTable.innerHTML = symbols.map(symbol => `
            <tr>
                <td>${escapeHTML(symbol.name)}</td>
                <td>${escapeHTML(symbol.type)}</td>
                <td>${escapeHTML(symbol.size)}</td>
            </tr>
        `).join("");
    }

    function renderSyntaxTree(declarations, invalidLines = []) {
        if (declarations.length === 0 && invalidLines.length === 0) {
            syntaxTree.innerHTML = `
                <p class="tree-message">
                    Compile your code to view the syntax tree.
                </p>
            `;
            return;
        }

        function createNode(label, children = [], extraClass = "") {
            const childHTML = children.length
                ? `<div class="tree-children">${children.join("")}</div>`
                : "";

            return `
                <div class="tree-node">
                    <div class="tree-box ${extraClass}">
                        ${escapeHTML(label)}
                    </div>
                    ${childHTML}
                </div>
            `;
        }

        const declarationNodes = declarations.map(declaration => {
            const details = [
                createNode(`Type: ${declaration.type}`, [], "tree-leaf"),
                createNode(`Name: ${declaration.name}`, [], "tree-leaf"),
                createNode(`Size: ${declaration.size}`, [], "tree-leaf")
            ];

            return createNode(
                `Declaration — Line ${declaration.line}`,
                [createNode("Array Declaration", details)]
            );
        });

        const errorNodes = invalidLines.map(item =>
            createNode(
                `Invalid — Line ${item.line}`,
                [createNode(item.text, [], "tree-error")]
            )
        );

        syntaxTree.innerHTML = `
            <div class="tree-node">
                <div class="tree-box tree-root">Program</div>
                <div class="tree-children">
                    ${[...declarationNodes, ...errorNodes].join("")}
                </div>
            </div>
        `;
    }

    function compileCode() {
        const code = sourceCode.value;

        resetPipeline();
        clearResults();

        if (!code.trim()) {
            output.textContent = "Please enter some C code first.";
            setResult(false, "No source code provided.");
            setStage("resultStep", "failed", "Failed");
            return;
        }

        const lines = code.split(/\r?\n/);
        const messages = [];
        const symbols = [];
        const declarations = [];
        const invalidLines = [];

        let lexicalError = false;
        let syntaxError = false;
        let semanticError = false;

        const supportedTypes = ["int", "float", "char", "double"];

        lines.forEach((originalLine, index) => {
            const line = originalLine.trim();
            const lineNumber = index + 1;

            if (!line) return;

            // This browser version handles one declaration per line.
            // Characters outside this mini-language are rejected.
            if (!/^[A-Za-z0-9_\s\[\];-]+$/.test(line)) {
                messages.push(
                    `LEXICAL ERROR: Unexpected character on line ${lineNumber}.`
                );

                lexicalError = true;
                invalidLines.push({ line: lineNumber, text: line });
                return;
            }

            const match = line.match(declarationPattern);

            if (!match) {
                const looksLikeUnsupportedType =
                    /^[A-Za-z_]\w*\s+[A-Za-z_]\w*\s*\[/.test(line) &&
                    !supportedTypes.includes(line.split(/\s+/)[0]);

                messages.push(
                    `SYNTAX ERROR: Invalid array declaration on line ${lineNumber}.` +
                    (looksLikeUnsupportedType
                        ? " The data type may not be supported."
                        : " Check the type, identifier, brackets, size and semicolon.")
                );

                syntaxError = true;
                invalidLines.push({ line: lineNumber, text: line });
                return;
            }

            const type = match[1];
            const name = match[2];
            const size = Number(match[3]);

            if (!Number.isSafeInteger(size) ||
                size <= 0 ||
                size > 1000000) {
                messages.push(
                    `SEMANTIC ERROR: Array '${name}' must have a size from 1 to 1000000.`
                );

                semanticError = true;
                invalidLines.push({ line: lineNumber, text: line });
                return;
            }

            messages.push(
                `Declared ${type} array '${name}' with size ${size}`
            );

            // Keep the same SYMBOL field order used by the original app.
            messages.push(`SYMBOL|${name}|${type}|${size}`);

            symbols.push({ name, type, size });
            declarations.push({ name, type, size, line: lineNumber });
        });

        if (declarations.length === 0 &&
            !lexicalError &&
            !syntaxError &&
            !semanticError) {
            messages.push("SYNTAX ERROR: No array declarations were found.");
            syntaxError = true;
        }

        const success =
            declarations.length > 0 &&
            !lexicalError &&
            !syntaxError &&
            !semanticError;

        messages.push("");
        messages.push(
            success
                ? "RESULT: Compilation successful!"
                : "RESULT: Compilation failed."
        );

        output.textContent = messages.join("\n");

        renderSymbolTable(symbols);
        renderSyntaxTree(declarations, invalidLines);

        setStage(
            "lexicalStep",
            lexicalError ? "failed" : "done",
            lexicalError ? "Error" : "Complete"
        );

        setStage(
            "syntaxStep",
            syntaxError ? "failed" : "done",
            syntaxError ? "Error" : "Complete"
        );

        setStage(
            "semanticStep",
            semanticError ? "failed" : "done",
            semanticError ? "Error" : "Complete"
        );

        setStage(
            "resultStep",
            success ? "done" : "failed",
            success ? "Passed" : "Failed"
        );

        setResult(
            success,
            success
                ? "Compilation completed successfully."
                : "Compilation failed. Check the compiler output."
        );
    }

    sourceCode.addEventListener("input", updateEditorInfo);

    sourceCode.addEventListener("scroll", () => {
        lineNumbers.scrollTop = sourceCode.scrollTop;
    });

    sourceCode.addEventListener("keydown", event => {
        if (event.key === "Tab") {
            event.preventDefault();

            sourceCode.setRangeText(
                "    ",
                sourceCode.selectionStart,
                sourceCode.selectionEnd,
                "end"
            );

            updateEditorInfo();
        }

        if ((event.ctrlKey || event.metaKey) &&
            event.key === "Enter") {
            event.preventDefault();
            compileCode();
        }
    });

    compileBtn.addEventListener("click", compileCode);

    clearBtn.addEventListener("click", () => {
        sourceCode.value = "";
        updateEditorInfo();
        clearResults();
        sourceCode.focus();
    });

    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(sourceCode.value);
            editorInfo.textContent = "Code copied!";
        } catch {
            editorInfo.textContent =
                "Copy failed. Select and copy manually.";
        }
    });

    copyOutputBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(output.textContent);

            const originalText = copyOutputBtn.textContent;
            copyOutputBtn.textContent = "Copied!";

            window.setTimeout(() => {
                copyOutputBtn.textContent = originalText;
            }, 1500);
        } catch {
            copyOutputBtn.textContent = "Copy failed";
        }
    });

    exampleSelect.addEventListener("change", () => {
        const example = examples[exampleSelect.value];

        if (example !== undefined) {
            sourceCode.value = example;
            updateEditorInfo();
            clearResults();
        }
    });

    updateEditorInfo();
});
