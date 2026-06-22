// ===== ESTADO DA APLICAÇÃO =====
let appState = {
    usuario: {
        nome: '',
        materiaAtual: ''
    },
    bancosDisponiveis: {}, // { "Matematica": [questoes], "Historia": [questoes] }
    provaAtual: [],
    indiceQuestaoAtual: 0,
    respostas: [], // { questao: {}, escolhida: "A", acertou: true }
    inicioProva: null,
    isModoRevisao: false, // Flag se é mini-simulado de erros
    
    // Dados de Gamificação e Evolução
    historico: [], 
    trofeus: 0,
    medalhas: { ouro: 0, prata: 0, bronze: 0, mestre: 0 },
    melhorSequenciaGlobal: 0
};

// Configurações Globais
const msgsMotivacionaisAcerto = [
    "Excelente trabalho!",
    "Você está dominando este conteúdo!",
    "Mais um passo rumo ao troféu!",
    "Continue assim!",
    "Acertou em cheio!",
    "Brilhante!"
];

const msgsMotivacionaisErro = [
    "Errar faz parte do aprendizado.",
    "Cada erro mostra o que precisa ser revisado.",
    "Você está evoluindo a cada tentativa.",
    "Continue treinando e sua nota irá crescer.",
    "Não desanime, a persistência leva à perfeição!"
];

// ===== INICIALIZAÇÃO =====
// ===== CONFIGURAÇÃO DE CONTROLE E ARMAZENAMENTO =====
const SYNC_URL = "https://kvdb.io/papai2026_glauc_family_384ff484/ranking";

function getStorageKey(baseKey) {
    // Extrai o nome do repositório/pasta do pathname da URL para isolar os dados
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    let keySuffix = 'local';
    if (pathParts.length > 0) {
        let lastPart = pathParts[pathParts.length - 1];
        if (lastPart.endsWith('.html')) {
            keySuffix = pathParts[pathParts.length - 2] || 'local';
        } else {
            keySuffix = lastPart;
        }
    }
    // Remove caracteres especiais
    keySuffix = keySuffix.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${baseKey}_${keySuffix}`;
}

let rankingGlobal = [];

async function carregarRanking() {
    try {
        const dados = localStorage.getItem(getStorageKey('papai2026_ranking'));
        if (dados) rankingGlobal = JSON.parse(dados);
    } catch(e) {}
    
    // Tenta carregar em paralelo os dados da nuvem para atualizar
    carregarRankingNuvem();
}

function salvarRanking() {
    try {
        localStorage.setItem(getStorageKey('papai2026_ranking'), JSON.stringify(rankingGlobal));
        salvarRankingNuvem(); // Sincroniza em segundo plano com a nuvem
    } catch(e) {}
}

async function salvarRankingNuvem() {
    try {
        await fetch(SYNC_URL, {
            method: 'POST',
            body: JSON.stringify(rankingGlobal),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.warn("Erro ao salvar ranking na nuvem (sem conexão?):", e);
    }
}

async function carregarRankingNuvem() {
    try {
        const res = await fetch(SYNC_URL);
        if (res.ok) {
            const dados = await res.json();
            if (Array.isArray(dados)) {
                rankingGlobal = dados;
                try {
                    localStorage.setItem(getStorageKey('papai2026_ranking'), JSON.stringify(rankingGlobal));
                } catch(e) {}
            }
        }
    } catch (e) {
        console.warn("Erro ao carregar ranking da nuvem (sem conexão?):", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosLocais();
    carregarRanking();
    configurarEventListeners();
    atualizarDropdownMaterias();
    validarFormularioInicial();
    carregarBancosPadrao(); // Baixa arquivos locais/github pages
});

async function listarArquivosGithub() {
    const hostname = window.location.hostname;
    if (hostname.includes('github.io')) {
        try {
            const owner = hostname.split('.')[0];
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                const repo = pathParts[0];
                const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/`);
                if (res.ok) {
                    const files = await res.json();
                    return files
                        .filter(f => f.name.endsWith('.json') && f.type === 'file' && f.name !== 'package.json')
                        .map(f => f.name);
                }
            }
        } catch (e) {
            console.warn("Erro ao carregar lista de arquivos do GitHub:", e);
        }
    }
    return [];
}

async function carregarBancosPadrao() {
    // Lista padrão local (fallback caso esteja offline ou localmente)
    let arquivosPadrao = ['modelo_banco_questoes.json', 'portuguesN2.json', 'QuimicaN2.json', 'banco_gerado.json', 'Geografia N2.json', 'Biologia N2.json', 'Geometria N2.json'];
    
    // Tenta obter dinamicamente os arquivos do repositório no GitHub
    const arquivosGithub = await listarArquivosGithub();
    if (arquivosGithub.length > 0) {
        arquivosPadrao = [...new Set([...arquivosPadrao, ...arquivosGithub])];
    }
    
    let teveMudanca = false;
    for (const arquivo of arquivosPadrao) {
        let nomeMateria = arquivo.replace('.json', '');
        
        // Mapeia arquivos específicos para nomes de exibição amigáveis
        if (nomeMateria === 'banco_gerado') nomeMateria = 'Inglês N2';
        else if (nomeMateria === 'portuguesN2') nomeMateria = 'Português N2';
        else nomeMateria = nomeMateria.charAt(0).toUpperCase() + nomeMateria.slice(1);
        
        if (!appState.bancosDisponiveis[nomeMateria]) {
            try {
                const res = await fetch(arquivo, { cache: 'no-cache' });
                if (res.ok) {
                    const data = await res.json();
                    appState.bancosDisponiveis[nomeMateria] = data;
                    teveMudanca = true;
                }
            } catch (e) {
                console.log("Erro ao baixar:", arquivo, e);
            }
        }
    }
    
    if (teveMudanca) {
        try { salvarDadosLocais(); } catch (e) {}
        atualizarDropdownMaterias();
        validarFormularioInicial();
    }
}

function configurarEventListeners() {
    // Configuração
    document.getElementById('input-json').addEventListener('change', handleUploadJSON);
    document.getElementById('btn-iniciar').addEventListener('click', iniciarSimuladoPadrao);
    document.getElementById('select-materia').addEventListener('change', validarFormularioInicial);
    document.getElementById('input-nome').addEventListener('input', validarFormularioInicial);
    
    // Prova e Feedback
    document.getElementById('btn-responder').addEventListener('click', confirmarResposta);
    document.getElementById('btn-proxima-questao').addEventListener('click', proximaQuestaoOuResultado);
    
    // Telas Adicionais
    document.getElementById('btn-fechar-revisao').addEventListener('click', voltarParaResultados);
    document.getElementById('btn-abrir-conquistas').addEventListener('click', mostrarConquistas);
    document.getElementById('btn-fechar-conquistas').addEventListener('click', voltarInicio);
    document.getElementById('btn-abrir-painel').addEventListener('click', mostrarPainelEvolucao);
    document.getElementById('btn-fechar-painel').addEventListener('click', voltarInicio);
    document.getElementById('btn-abrir-ranking').addEventListener('click', mostrarRanking);
    
    // Resultado Actions
    document.getElementById('btn-voltar-inicio').addEventListener('click', voltarInicio);
    document.getElementById('btn-revisar-erradas').addEventListener('click', mostrarRevisaoErradas);
    document.getElementById('btn-refazer-erradas').addEventListener('click', iniciarModoRevisao);
}

// ===== PERSISTÊNCIA =====
function salvarDadosLocais() {
    localStorage.setItem(getStorageKey('papai2026_profile'), JSON.stringify({
        historico: appState.historico,
        trofeus: appState.trofeus,
        medalhas: appState.medalhas,
        bancosDisponiveis: appState.bancosDisponiveis,
        ultimoNome: appState.usuario.nome,
        melhorSequenciaGlobal: appState.melhorSequenciaGlobal
    }));
}

function carregarDadosLocais() {
    const saved = localStorage.getItem(getStorageKey('papai2026_profile'));
    if (saved) {
        try {
            const data = JSON.parse(saved);
            appState.historico = data.historico || [];
            appState.trofeus = data.trofeus || 0;
            appState.medalhas = data.medalhas || { ouro: 0, prata: 0, bronze: 0, mestre: 0 };
            appState.bancosDisponiveis = data.bancosDisponiveis || {};
            appState.melhorSequenciaGlobal = data.melhorSequenciaGlobal || 0;
            
            if(data.ultimoNome) document.getElementById('input-nome').value = data.ultimoNome;
        } catch (e) {
            console.error("Erro ao carregar dados do localStorage:", e);
        }
    }
}

// ===== GERENCIAMENTO DE BANCOS =====
function handleUploadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    let nomeMateria = file.name.replace('.json', '');
    nomeMateria = nomeMateria.charAt(0).toUpperCase() + nomeMateria.slice(1);

    const reader = new FileReader();
    reader.onload = function(event) {
        let parsedData;
        try {
            parsedData = JSON.parse(event.target.result);
        } catch (err) {
            alert("Erro ao ler o arquivo JSON. O formato está incorreto.");
            console.error(err);
            e.target.value = '';
            return;
        }

        appState.bancosDisponiveis[nomeMateria] = parsedData;
        
        try {
            salvarDadosLocais();
        } catch (err) {
            console.error("Erro ao salvar no localStorage (possível limite de espaço):", err);
            // Mesmo se falhar ao salvar, mantém na memória para a sessão atual
        }
        
        // Atualizar UI
        atualizarDropdownMaterias();
        document.getElementById('select-materia').value = nomeMateria;
        
        document.getElementById('status-banco').classList.remove('hidden');
        document.getElementById('nome-materia-carregada').innerText = nomeMateria;
        document.getElementById('total-questoes').innerText = parsedData.length;
        
        validarFormularioInicial();
        alert(`Banco de ${nomeMateria} carregado com sucesso!`);
        
        // Limpar o input para permitir enviar o mesmo arquivo novamente
        e.target.value = '';
    };
    reader.readAsText(file);
}

function atualizarDropdownMaterias() {
    const select = document.getElementById('select-materia');
    const materias = Object.keys(appState.bancosDisponiveis);
    
    select.innerHTML = '';
    
    if (materias.length === 0) {
        select.innerHTML = '<option value="">Nenhum banco carregado. Envie um arquivo JSON acima ☝️</option>';
    } else {
        select.innerHTML = '<option value="">Selecione uma matéria</option>';
        materias.forEach(mat => {
            const opt = document.createElement('option');
            opt.value = mat;
            opt.innerText = mat;
            select.appendChild(opt);
        });
    }
}

function validarFormularioInicial() {
    const nome = document.getElementById('input-nome').value.trim();
    const materia = document.getElementById('select-materia').value;
    const btn = document.getElementById('btn-iniciar');
    
    if (nome && materia && appState.bancosDisponiveis[materia]) {
        btn.classList.remove('disabled');
        // Mostrar total de questões da matéria selecionada
        document.getElementById('status-banco').classList.remove('hidden');
        document.getElementById('nome-materia-carregada').innerText = materia;
        document.getElementById('total-questoes').innerText = appState.bancosDisponiveis[materia].length;
    } else {
        btn.classList.add('disabled');
        document.getElementById('status-banco').classList.add('hidden');
    }
}

// ===== GERAÇÃO DA PROVA =====
function embaralhar(array) {
    let clone = [...array];
    for (let i = clone.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
}

function iniciarSimuladoPadrao() {
    const btn = document.getElementById('btn-iniciar');
    if (btn.classList.contains('disabled')) return;

    appState.usuario.nome = document.getElementById('input-nome').value.trim();
    appState.usuario.materiaAtual = document.getElementById('select-materia').value;
    
    const banco = appState.bancosDisponiveis[appState.usuario.materiaAtual];
    const qtdStr = document.getElementById('select-quantidade').value;
    const qtd = parseInt(qtdStr);
    const nivel = document.getElementById('select-nivel').value;

    let proporcoes = { f: 0.33, m: 0.33, d: 0.33 };
    if (nivel === 'facil') proporcoes = { f: 0.50, m: 0.25, d: 0.25 };
    if (nivel === 'medio') proporcoes = { f: 0.25, m: 0.50, d: 0.25 };
    if (nivel === 'dificil') proporcoes = { f: 0.25, m: 0.25, d: 0.50 };

    const faceis = embaralhar(banco.filter(q => q.nivel === 'facil'));
    const medias = embaralhar(banco.filter(q => q.nivel === 'medio'));
    const dificeis = embaralhar(banco.filter(q => q.nivel === 'dificil'));

    let selecionadas = [];
    selecionadas.push(...faceis.slice(0, Math.floor(qtd * proporcoes.f)));
    selecionadas.push(...medias.slice(0, Math.floor(qtd * proporcoes.m)));
    selecionadas.push(...dificeis.slice(0, Math.floor(qtd * proporcoes.d)));

    // Completar
    let restantes = embaralhar(banco.filter(q => !selecionadas.includes(q)));
    while (selecionadas.length < qtd && restantes.length > 0) {
        selecionadas.push(restantes.pop());
    }

    appState.provaAtual = embaralhar(selecionadas).slice(0, qtd);
    
    if(appState.provaAtual.length === 0) {
        alert("Não há questões suficientes no banco selecionado.");
        return;
    }

    appState.isModoRevisao = false;
    prepararProvaUI();
}

function iniciarModoRevisao() {
    // Pega as questões erradas da ÚLTIMA prova
    const erros = appState.respostas.filter(r => !r.acertou).map(r => r.questao);
    if(erros.length === 0) {
        alert("Nenhum erro para revisar!");
        return;
    }
    
    appState.provaAtual = embaralhar(erros);
    appState.isModoRevisao = true;
    
    document.getElementById('tela-resultado').classList.add('hidden');
    prepararProvaUI();
}

// ===== FLUXO DA PROVA =====
function prepararProvaUI() {
    appState.indiceQuestaoAtual = 0;
    appState.respostas = []; // Reseta para a nova prova
    appState.inicioProva = Date.now();
    salvarDadosLocais();

    trocarTela(document.querySelector('.tela.ativa').id, 'tela-prova');
    
    document.getElementById('prova-materia').innerText = appState.usuario.materiaAtual;
    
    if(appState.isModoRevisao) {
        document.getElementById('prova-nivel').classList.add('hidden');
        document.getElementById('prova-modo').classList.remove('hidden');
    } else {
        const selectNivel = document.getElementById('select-nivel');
        document.getElementById('prova-nivel').innerText = selectNivel.options[selectNivel.selectedIndex].text;
        document.getElementById('prova-nivel').classList.remove('hidden');
        document.getElementById('prova-modo').classList.add('hidden');
    }
    
    if(window.timerInterval) clearInterval(window.timerInterval);
    window.timerInterval = setInterval(atualizarCronometro, 1000);

    renderizarQuestao();
}

function atualizarCronometro() {
    const decorrido = Math.floor((Date.now() - appState.inicioProva) / 1000);
    const m = String(Math.floor(decorrido / 60)).padStart(2, '0');
    const s = String(decorrido % 60).padStart(2, '0');
    document.getElementById('tempo-decorrido').innerText = `${m}:${s}`;
}

let alternativaSelecionada = null;

function renderizarQuestao() {
    const questao = appState.provaAtual[appState.indiceQuestaoAtual];
    const indexStr = (appState.indiceQuestaoAtual + 1);
    const total = appState.provaAtual.length;
    const percent = Math.round((appState.indiceQuestaoAtual / total) * 100);

    document.getElementById('questao-atual-num').innerText = indexStr;
    document.getElementById('questao-total-num').innerText = total;
    document.getElementById('questao-percentual').innerText = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;

    document.getElementById('questao-assunto').innerText = questao.assunto;
    const diffBadge = document.getElementById('questao-dificuldade');
    diffBadge.innerText = questao.nivel.toUpperCase();
    diffBadge.className = `badge ${questao.nivel}`;

    document.getElementById('enunciado').innerText = questao.enunciado;

    const container = document.getElementById('alternativas-container');
    container.innerHTML = '';
    alternativaSelecionada = null;
    
    let alts = embaralhar([...questao.alternativas]);
    alts.forEach(alt => {
        const btn = document.createElement('button');
        btn.className = 'alternativa-btn';
        btn.innerText = alt;
        btn.onclick = () => {
            document.querySelectorAll('.alternativa-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            alternativaSelecionada = alt;
            document.getElementById('btn-responder').classList.remove('disabled');
        };
        container.appendChild(btn);
    });

    document.getElementById('btn-responder').classList.add('disabled');
}

function confirmarResposta() {
    if(!alternativaSelecionada) return;

    const questao = appState.provaAtual[appState.indiceQuestaoAtual];
    const acertou = alternativaSelecionada === questao.correta;

    appState.respostas.push({
        questao: questao,
        escolhida: alternativaSelecionada,
        acertou: acertou
    });

    exibirFeedback(acertou, questao);
}

// ===== FEEDBACK IMEDIATO =====
function exibirFeedback(acertou, questao) {
    const modal = document.getElementById('modal-feedback');
    const box = document.getElementById('feedback-box');
    const correctDiv = document.getElementById('feedback-correct-answer');
    const commentBox = document.getElementById('feedback-comment');
    
    modal.classList.remove('hidden');
    box.className = `modal-content feedback-box ${acertou ? 'correct' : 'incorrect'}`;
    
    if (acertou) {
        document.getElementById('feedback-icon').innerText = "🎉";
        document.getElementById('feedback-title').innerText = "Resposta Correta!";
        document.getElementById('feedback-message').innerText = `${msgsMotivacionaisAcerto[Math.floor(Math.random() * msgsMotivacionaisAcerto.length)]} Parabéns, ${appState.usuario.nome}!`;
        correctDiv.classList.add('hidden');
        commentBox.innerText = questao.comentario ? `Muito bem! ${questao.comentario.split('.')[0]}.` : "Ótima linha de raciocínio.";
        dispararConfete();
    } else {
        document.getElementById('feedback-icon').innerText = "❌";
        document.getElementById('feedback-title').innerText = "Resposta Incorreta";
        document.getElementById('feedback-message').innerText = `${msgsMotivacionaisErro[Math.floor(Math.random() * msgsMotivacionaisErro.length)]} Não desanime, ${appState.usuario.nome}!`;
        correctDiv.classList.remove('hidden');
        document.getElementById('texto-correta').innerText = questao.correta;
        commentBox.innerText = questao.comentario || "Revise este assunto para não errar na próxima.";
    }
}

function dispararConfete() {
    if(typeof confetti !== 'undefined') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

function proximaQuestaoOuResultado() {
    document.getElementById('modal-feedback').classList.add('hidden');

    appState.indiceQuestaoAtual++;
    
    if (appState.indiceQuestaoAtual < appState.provaAtual.length) {
        renderizarQuestao();
    } else {
        finalizarProva();
    }
}

// ===== RESULTADOS E HISTÓRICO =====
function finalizarProva() {
    clearInterval(window.timerInterval);
    document.getElementById('progress-fill').style.width = `100%`;
    
    const acertos = appState.respostas.filter(r => r.acertou).length;
    const erros = appState.respostas.length - acertos;
    const total = appState.provaAtual.length;
    const percentual = Math.round((acertos / total) * 100);
    const tempoFinal = document.getElementById('tempo-decorrido').innerText;

    // Apenas registra no histórico principal se NÃO for modo revisão
    if(!appState.isModoRevisao) {
        const nivel = document.getElementById('select-nivel').value;
        const dataStr = new Date().toISOString();
        
        // Calcular Medalha
        let classRes = "success";
        let msgRes = "";
        
        if (percentual === 100) { appState.medalhas.mestre++; msgRes = "Perfeito! Nível Mestre alcançado."; }
        else if (percentual >= 95) { appState.medalhas.ouro++; msgRes = "Incrível! Medalha de Ouro."; }
        else if (percentual >= 85) { appState.medalhas.prata++; msgRes = "Ótimo trabalho! Medalha de Prata."; }
        else if (percentual >= 70) { appState.medalhas.bronze++; msgRes = "Bom trabalho! Medalha de Bronze."; }
        else { classRes = "danger"; msgRes = "Continue estudando, você consegue!"; }

        // Gravar Tentativa
        const tentativa = {
            data: dataStr,
            materia: appState.usuario.materiaAtual,
            nivel: nivel,
            nota: percentual,
            acertos: acertos,
            total: total,
            tempo: tempoFinal,
            respostasDetalhadas: [...appState.respostas]
        };
        appState.historico.push(tentativa);

        // Salvar no ranking global
        rankingGlobal.push({
            nome: appState.usuario.nome,
            materia: appState.usuario.materiaAtual,
            nota: percentual,
            data: dataStr
        });
        salvarRanking();

        // Checar Troféus (a cada 3 perfeitas totais)
        const perfeitasTotais = appState.historico.filter(t => t.nota === 100).length;
        let ganhouTrofeu = (perfeitasTotais > 0 && perfeitasTotais % 3 === 0 && percentual === 100);
        if(ganhouTrofeu) {
            appState.trofeus++;
            document.getElementById('novo-trofeu-alert').classList.remove('hidden');
        } else {
            document.getElementById('novo-trofeu-alert').classList.add('hidden');
        }
        
        salvarDadosLocais();
    } else {
        document.getElementById('novo-trofeu-alert').classList.add('hidden');
    }

    // Renderizar Tela Resultado
    trocarTela('tela-prova', 'tela-resultado');
    
    // Atualizar UI
    let medalhaIcon = "📚";
    if(percentual === 100) medalhaIcon = "🏆";
    else if(percentual >= 95) medalhaIcon = "🥇";
    else if(percentual >= 85) medalhaIcon = "🥈";
    else if(percentual >= 70) medalhaIcon = "🥉";
    
    document.getElementById('medalha-container').innerHTML = medalhaIcon;
    const pEl = document.getElementById('resultado-percentual');
    pEl.innerText = `${percentual}%`;
    pEl.className = `percentual-destaque ${percentual < 70 ? 'danger' : 'success'}`;
    
    let msgFinal = "";
    if (percentual === 100) msgFinal = `Perfeito, ${appState.usuario.nome}! Você não errou nada!`;
    else if (percentual >= 80) msgFinal = `Excelente, ${appState.usuario.nome}! Muito bom!`;
    else if (percentual >= 60) msgFinal = `Bom trabalho, ${appState.usuario.nome}!`;
    else msgFinal = `Continue estudando, ${appState.usuario.nome}! Você consegue melhorar.`;
    
    document.getElementById('resultado-mensagem').innerText = appState.isModoRevisao ? "Modo revisão concluído!" : msgFinal;
    document.getElementById('res-acertos').innerText = acertos;
    document.getElementById('res-erros').innerText = erros;
    document.getElementById('res-tempo').innerText = tempoFinal;

    // Botões de Revisão
    if(erros > 0) {
        document.getElementById('btn-revisar-erradas').style.display = 'inline-block';
        document.getElementById('btn-refazer-erradas').style.display = 'inline-block';
    } else {
        document.getElementById('btn-revisar-erradas').style.display = 'none';
        document.getElementById('btn-refazer-erradas').style.display = 'none';
    }
}

// ===== REVISÃO DE QUESTÕES =====
function mostrarRevisaoErradas() {
    const erradas = appState.respostas.filter(r => !r.acertou);
    const container = document.getElementById('lista-revisao-container');
    container.innerHTML = '';
    
    erradas.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'revisao-card';
        div.innerHTML = `
            <h4><strong>${index+1}.</strong> ${item.questao.enunciado}</h4>
            <div class="revisao-respostas">
                <div class="revisao-box box-errada">
                    <strong>Sua Resposta:</strong><br>${item.escolhida}
                </div>
                <div class="revisao-box box-correta">
                    <strong>Resposta Correta:</strong><br>${item.questao.correta}
                </div>
            </div>
            <div class="revisao-comentario">
                <strong>Explicação:</strong> ${item.questao.comentario || 'Sem comentário adicional.'}
            </div>
        `;
        container.appendChild(div);
    });

    trocarTela('tela-resultado', 'tela-revisao');
}

function voltarParaResultados() {
    trocarTela('tela-revisao', 'tela-resultado');
}

// ===== CONQUISTAS =====
function mostrarConquistas() {
    document.querySelectorAll('.tela').forEach(t => {
        t.classList.remove('ativa');
        t.classList.add('hidden');
    });
    document.getElementById('tela-conquistas').classList.remove('hidden');
    document.getElementById('tela-conquistas').classList.add('ativa');

    document.getElementById('conq-trofeus').innerText = `${appState.trofeus} conquistados`;
    document.getElementById('conq-ouro').innerText = `${appState.medalhas.ouro} conquistadas`;
    document.getElementById('conq-prata').innerText = `${appState.medalhas.prata} conquistadas`;
    document.getElementById('conq-bronze').innerText = `${appState.medalhas.bronze} conquistadas`;
    
    const hist = appState.historico;
    let perfeitas = hist.filter(t => t.nota === 100).length;
    let melhor = hist.length > 0 ? Math.max(...hist.map(t => t.nota)) : 0;
    
    // Calcular sequência atual de provas >= 70%
    let seqAtual = 0;
    for(let i = hist.length - 1; i >= 0; i--) {
        if(hist[i].nota >= 70) seqAtual++; else break;
    }
    
    if(seqAtual > appState.melhorSequenciaGlobal) {
        appState.melhorSequenciaGlobal = seqAtual;
        salvarDadosLocais();
    }

    document.getElementById('conq-melhor').innerText = `${melhor}%`;
    document.getElementById('conq-seq').innerText = `${seqAtual} 🔥`;
    document.getElementById('conq-perfeitas').innerText = perfeitas;
}

// ===== PAINEL DE EVOLUÇÃO (ESTATÍSTICAS) =====
let graficoEvolucao = null;

function mostrarPainelEvolucao() {
    document.querySelectorAll('.tela').forEach(t => {
        t.classList.remove('ativa');
        t.classList.add('hidden');
    });
    document.getElementById('tela-painel').classList.remove('hidden');
    document.getElementById('tela-painel').classList.add('ativa');

    const hist = appState.historico;
    const totalProvas = hist.length;
    
    const notas = hist.map(t => t.nota);
    const mediaGeral = totalProvas > 0 ? Math.round(notas.reduce((a,b)=>a+b,0) / totalProvas) : 0;
    const melhorGeral = totalProvas > 0 ? Math.max(...notas) : 0;
    const totalQuestoes = hist.reduce((acc, t) => acc + t.total, 0);
    const totalAcertos = hist.reduce((acc, t) => acc + t.acertos, 0);
    const totalErros = totalQuestoes - totalAcertos;

    document.getElementById('dash-total-provas').innerText = totalProvas;
    document.getElementById('dash-media-geral').innerText = `${mediaGeral}%`;
    document.getElementById('dash-melhor-geral').innerText = `${melhorGeral}%`;
    document.getElementById('dash-total-questoes').innerText = totalQuestoes;
    document.getElementById('dash-total-acertos').innerText = totalAcertos;
    document.getElementById('dash-total-erros').innerText = totalErros;

    // Gráfico de Evolução
    const ctx = document.getElementById('chart-evolucao').getContext('2d');
    if (graficoEvolucao) graficoEvolucao.destroy();
    
    graficoEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hist.map((_, i) => `T${i+1}`),
            datasets: [{
                label: 'Nota da Prova (%)',
                data: notas,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: '#3b82f6',
                fill: true, tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    // Evolução por Matéria
    const mapMaterias = {};
    hist.forEach(t => {
        if(!mapMaterias[t.materia]) mapMaterias[t.materia] = { notas: [], tentativas: 0 };
        mapMaterias[t.materia].notas.push(t.nota);
        mapMaterias[t.materia].tentativas++;
    });

    const tbodyMat = document.getElementById('tbody-materias');
    tbodyMat.innerHTML = '';
    Object.keys(mapMaterias).forEach(mat => {
        let n = mapMaterias[mat].notas;
        let max = Math.max(...n);
        let med = Math.round(n.reduce((a,b)=>a+b,0) / n.length);
        tbodyMat.innerHTML += `<tr><td>${mat}</td><td>${mapMaterias[mat].tentativas}</td><td>${max}%</td><td>${med}%</td></tr>`;
    });

    preencherTabelaMaterias(hist);
    preencherTabelaNiveis(hist);
}

function preencherTabelaMaterias(hist) {
    const tbody = document.getElementById('tbody-materias');
    tbody.innerHTML = '';

    const dadosMateria = {};
    hist.forEach(t => {
        if (!dadosMateria[t.materia]) dadosMateria[t.materia] = { tent: 0, soma: 0, melhor: 0 };
        dadosMateria[t.materia].tent++;
        dadosMateria[t.materia].soma += t.nota;
        if (t.nota > dadosMateria[t.materia].melhor) dadosMateria[t.materia].melhor = t.nota;
    });

    for (const [mat, d] of Object.entries(dadosMateria)) {
        let media = Math.round(d.soma / d.tent);
        tbody.innerHTML += `
            <tr>
                <td><strong>${mat}</strong></td>
                <td>${d.tent}</td>
                <td style="color:var(--success-color)">${d.melhor}%</td>
                <td>${media}%</td>
            </tr>
        `;
    }
}

function preencherTabelaNiveis(hist) {
    const tbody = document.getElementById('tbody-niveis');
    tbody.innerHTML = '';

    const dados = { facil: {t:0, s:0}, medio: {t:0, s:0}, dificil: {t:0, s:0} };
    hist.forEach(t => {
        if (dados[t.nivel]) {
            dados[t.nivel].t++;
            dados[t.nivel].s += t.nota;
        }
    });

    for (const [niv, d] of Object.entries(dados)) {
        if (d.t > 0) {
            let label = niv.charAt(0).toUpperCase() + niv.slice(1);
            let media = Math.round(d.s / d.t);
            tbody.innerHTML += `
                <tr>
                    <td>${label}</td>
                    <td>${d.t}</td>
                    <td>${media}%</td>
                </tr>
            `;
        }
    }
}

// ===== RANKING GLOBAL =====
async function mostrarRanking() {
    // Tenta obter os resultados mais recentes da nuvem antes de exibir o ranking
    await carregarRankingNuvem();
    
    document.querySelectorAll('.tela').forEach(t => {
        t.classList.remove('ativa');
        t.classList.add('hidden');
    });
    document.getElementById('tela-ranking').classList.remove('hidden');
    document.getElementById('tela-ranking').classList.add('ativa');
    
    const tbody = document.getElementById('tabela-ranking');
    tbody.innerHTML = '';
    
    // Agrupar a melhor nota de cada usuário
    let melhores = {};
    rankingGlobal.forEach(r => {
        // Ignora se não houver nome
        if (!r.nome) return;
        if (!melhores[r.nome] || r.nota > melhores[r.nome].nota) {
            melhores[r.nome] = r;
        }
    });
    
    // Ordenar por nota descrecente
    const lista = Object.values(melhores).sort((a,b) => b.nota - a.nota);
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Ninguém jogou ainda. Seja o primeiro da plataforma!</td></tr>';
        return;
    }
    
    lista.forEach((item, index) => {
        let pos = index + 1;
        let posStr = pos + 'º';
        if (pos === 1) posStr = '🥇 1º';
        if (pos === 2) posStr = '🥈 2º';
        if (pos === 3) posStr = '🥉 3º';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${posStr}</strong></td>
                <td>${item.nome}</td>
                <td>${item.materia}</td>
                <td style="color: var(--accent-color); font-weight: bold;">${item.nota}%</td>
            </tr>
        `;
    });
}

// ===== UTILITÁRIOS =====
function trocarTela(idEsconder, idMostrar) {
    document.getElementById(idEsconder).classList.remove('ativa');
    document.getElementById(idEsconder).classList.add('hidden');
    
    document.getElementById(idMostrar).classList.remove('hidden');
    document.getElementById(idMostrar).classList.add('ativa');
}

function voltarInicio() {
    document.querySelectorAll('.tela').forEach(t => {
        t.classList.remove('ativa');
        t.classList.add('hidden');
    });
    
    document.getElementById('tela-configuracao').classList.remove('hidden');
    document.getElementById('tela-configuracao').classList.add('ativa');
    
    validarFormularioInicial();
}
