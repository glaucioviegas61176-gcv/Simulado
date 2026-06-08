// ===== ESTADO DA APLICAÇÃO =====
let appState = {
    usuario: {
        nome: '',
        materia: ''
    },
    bancoOriginal: [], // Todas as questões carregadas
    provaAtual: [],    // Questões selecionadas para a prova
    indiceQuestaoAtual: 0,
    respostas: [],     // Guarda se acertou ou errou cada questão
    inicioProva: null,
    
    // Dados de Gamificação e Evolução persistidos
    historico: [], 
    trofeus: 0,
    medalhas: { ouro: 0, prata: 0, bronze: 0, mestre: 0 },
    errosPorAssunto: {} // Para o aprendizado adaptativo { "Matemática - Frações": 5 }
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
document.addEventListener('DOMContentLoaded', () => {
    carregarDadosLocais();
    configurarEventListeners();
    atualizarUIInicial();
});

function configurarEventListeners() {
    // Tela Inicial
    document.getElementById('input-json').addEventListener('change', handleUploadJSON);
    document.getElementById('btn-iniciar').addEventListener('click', iniciarSimulado);
    document.getElementById('btn-abrir-painel').addEventListener('click', mostrarPainelEvolucao);
    document.getElementById('btn-modo-revisao').addEventListener('click', iniciarModoRevisao);
    
    // Tela Prova
    document.getElementById('btn-responder').addEventListener('click', confirmarResposta);
    
    // Modal Feedback
    document.getElementById('btn-proxima-questao').addEventListener('click', proximaQuestaoOuResultado);
    
    // Tela Resultados
    document.getElementById('btn-ver-painel-res').addEventListener('click', mostrarPainelEvolucao);
    document.getElementById('btn-voltar-inicio').addEventListener('click', voltarInicio);
    
    // Tela Painel
    document.getElementById('btn-fechar-painel').addEventListener('click', voltarInicio);

    // Inputs validação
    document.getElementById('input-nome').addEventListener('input', validarFormularioInicial);
    document.getElementById('input-materia').addEventListener('input', validarFormularioInicial);
}

// ===== PERSISTÊNCIA =====
function salvarDadosLocais() {
    localStorage.setItem('neuroTestProfile', JSON.stringify({
        historico: appState.historico,
        trofeus: appState.trofeus,
        medalhas: appState.medalhas,
        errosPorAssunto: appState.errosPorAssunto,
        ultimoNome: appState.usuario.nome,
        ultimaMateria: appState.usuario.materia
    }));
}

function carregarDadosLocais() {
    const saved = localStorage.getItem('neuroTestProfile');
    if (saved) {
        const data = JSON.parse(saved);
        appState.historico = data.historico || [];
        appState.trofeus = data.trofeus || 0;
        appState.medalhas = data.medalhas || { ouro: 0, prata: 0, bronze: 0, mestre: 0 };
        appState.errosPorAssunto = data.errosPorAssunto || {};
        
        if(data.ultimoNome) document.getElementById('input-nome').value = data.ultimoNome;
        if(data.ultimaMateria) document.getElementById('input-materia').value = data.ultimaMateria;
    }
}

function atualizarUIInicial() {
    // Se tiver erros registrados, habilita botão de revisão
    const temErros = Object.values(appState.errosPorAssunto).reduce((a, b) => a + b, 0) > 0;
    if (temErros && appState.bancoOriginal.length > 0) {
        document.getElementById('btn-modo-revisao').style.display = 'inline-flex';
    }
}

// ===== CARREGAMENTO DE ARQUIVOS =====
function handleUploadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);
            appState.bancoOriginal = data;
            
            // Atualizar UI
            document.getElementById('status-banco').classList.remove('hidden');
            document.getElementById('total-questoes').innerText = data.length;
            
            const qtdFacil = data.filter(q => q.nivel === 'facil').length;
            const qtdMedio = data.filter(q => q.nivel === 'medio').length;
            const qtdDificil = data.filter(q => q.nivel === 'dificil').length;
            
            document.getElementById('qtd-facil').innerText = qtdFacil;
            document.getElementById('qtd-medio').innerText = qtdMedio;
            document.getElementById('qtd-dificil').innerText = qtdDificil;
            
            validarFormularioInicial();
            atualizarUIInicial();
        } catch (err) {
            alert("Erro ao ler o arquivo JSON. Verifique a formatação.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

function validarFormularioInicial() {
    const nome = document.getElementById('input-nome').value.trim();
    const materia = document.getElementById('input-materia').value.trim();
    const temBanco = appState.bancoOriginal.length > 0;
    const btn = document.getElementById('btn-iniciar');
    
    if (nome && materia && temBanco) {
        btn.classList.remove('disabled');
    } else {
        btn.classList.add('disabled');
    }
}

// ===== GERAÇÃO DA PROVA =====
function embaralhar(array) {
    let atual = array.length, temp, aleatorio;
    while (atual !== 0) {
        aleatorio = Math.floor(Math.random() * atual);
        atual -= 1;
        temp = array[atual];
        array[atual] = array[aleatorio];
        array[aleatorio] = temp;
    }
    return array;
}

function selecionarQuestoes(qtdDesejada, proporcoes) {
    const faceis = embaralhar(appState.bancoOriginal.filter(q => q.nivel === 'facil'));
    const medias = embaralhar(appState.bancoOriginal.filter(q => q.nivel === 'medio'));
    const dificeis = embaralhar(appState.bancoOriginal.filter(q => q.nivel === 'dificil'));

    let qtdFacil = Math.floor(qtdDesejada * proporcoes.f);
    let qtdMedio = Math.floor(qtdDesejada * proporcoes.m);
    let qtdDificil = Math.floor(qtdDesejada * proporcoes.d);

    // Ajuste fino para sobras devido ao arredondamento
    let selecionadas = [];
    selecionadas.push(...faceis.slice(0, qtdFacil));
    selecionadas.push(...medias.slice(0, qtdMedio));
    selecionadas.push(...dificeis.slice(0, qtdDificil));

    // Completar com aleatórias caso falte por causa de limite de banco
    let restantes = appState.bancoOriginal.filter(q => !selecionadas.includes(q));
    restantes = embaralhar(restantes);
    
    while (selecionadas.length < qtdDesejada && restantes.length > 0) {
        selecionadas.push(restantes.pop());
    }

    return embaralhar(selecionadas).slice(0, qtdDesejada); // Garante o limite e embaralha a prova final
}

function iniciarSimulado() {
    const btn = document.getElementById('btn-iniciar');
    if (btn.classList.contains('disabled')) return;

    appState.usuario.nome = document.getElementById('input-nome').value.trim();
    appState.usuario.materia = document.getElementById('input-materia').value.trim();
    
    const qtdStr = document.getElementById('select-quantidade').value;
    const qtd = qtdStr === 'todas' ? appState.bancoOriginal.length : parseInt(qtdStr);
    const nivel = document.getElementById('select-nivel').value;

    let proporcoes = { f: 0.33, m: 0.33, d: 0.33 };
    if (nivel === 'facil') proporcoes = { f: 0.50, m: 0.25, d: 0.25 };
    if (nivel === 'medio') proporcoes = { f: 0.25, m: 0.50, d: 0.25 };
    if (nivel === 'dificil') proporcoes = { f: 0.25, m: 0.25, d: 0.50 };

    appState.provaAtual = selecionarQuestoes(qtd, proporcoes);
    
    if(appState.provaAtual.length === 0) {
        alert("O banco de questões não possui questões suficientes.");
        return;
    }

    prepararProvaUI();
}

function iniciarModoRevisao() {
    appState.usuario.nome = document.getElementById('input-nome').value.trim() || 'Aluno';
    appState.usuario.materia = document.getElementById('input-materia').value.trim() || 'Revisão Geral';

    // Seleciona as questões cujos assuntos estão no objeto de erros
    let assuntosCriticos = Object.keys(appState.errosPorAssunto).sort((a,b) => appState.errosPorAssunto[b] - appState.errosPorAssunto[a]);
    
    let selecionadas = [];
    appState.bancoOriginal.forEach(q => {
        let key = `${q.materia} - ${q.assunto}`;
        if(assuntosCriticos.includes(key) && appState.errosPorAssunto[key] > 0) {
            selecionadas.push(q);
        }
    });

    if(selecionadas.length === 0) {
        alert("Não há histórico de erros no banco atual para revisar!");
        return;
    }

    // Pega as top 20
    appState.provaAtual = embaralhar(selecionadas).slice(0, 20);
    prepararProvaUI();
}

// ===== FLUXO DA PROVA =====
function prepararProvaUI() {
    appState.indiceQuestaoAtual = 0;
    appState.respostas = [];
    appState.inicioProva = Date.now();
    salvarDadosLocais(); // Salva perfil

    trocarTela('tela-configuracao', 'tela-prova');
    
    document.getElementById('prova-materia').innerText = appState.usuario.materia;
    document.getElementById('prova-nivel').innerText = document.getElementById('select-nivel').options[document.getElementById('select-nivel').selectedIndex].text.split(' ')[0];
    
    // Iniciar Cronômetro (simples)
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

function renderizarQuestao() {
    const questao = appState.provaAtual[appState.indiceQuestaoAtual];
    const indexStr = (appState.indiceQuestaoAtual + 1);
    const total = appState.provaAtual.length;
    const percent = Math.round((appState.indiceQuestaoAtual / total) * 100);

    // Header & Progresso
    document.getElementById('questao-atual-num').innerText = indexStr;
    document.getElementById('questao-total-num').innerText = total;
    document.getElementById('questao-percentual').innerText = `${percent}%`;
    document.getElementById('progress-fill').style.width = `${percent}%`;

    // Meta da questão
    document.getElementById('questao-assunto').innerText = questao.assunto;
    const diffBadge = document.getElementById('questao-dificuldade');
    diffBadge.innerText = questao.nivel.toUpperCase();
    diffBadge.className = `badge ${questao.nivel}`;

    // Conteúdo
    document.getElementById('enunciado').innerText = questao.enunciado;

    // Alternativas
    const container = document.getElementById('alternativas-container');
    container.innerHTML = '';
    
    let alts = embaralhar([...questao.alternativas]);
    alts.forEach(alt => {
        const btn = document.createElement('button');
        btn.className = 'alternativa-btn';
        btn.innerText = alt;
        btn.onclick = () => selecionarAlternativa(btn);
        container.appendChild(btn);
    });

    document.getElementById('btn-responder').classList.add('disabled');
}

let alternativaSelecionada = null;

function selecionarAlternativa(btnRef) {
    document.querySelectorAll('.alternativa-btn').forEach(b => b.classList.remove('selected'));
    btnRef.classList.add('selected');
    alternativaSelecionada = btnRef.innerText;
    document.getElementById('btn-responder').classList.remove('disabled');
}

function confirmarResposta() {
    if(!alternativaSelecionada) return;

    const questao = appState.provaAtual[appState.indiceQuestaoAtual];
    const acertou = alternativaSelecionada === questao.correta;

    // Registrar no estado
    appState.respostas.push(acertou);

    // Aprendizado adaptativo (Registrar erro por assunto)
    if(!acertou) {
        const key = `${questao.materia} - ${questao.assunto}`;
        appState.errosPorAssunto[key] = (appState.errosPorAssunto[key] || 0) + 1;
    }

    exibirFeedback(acertou, questao);
}

// ===== FEEDBACK IMEDIATO =====
function exibirFeedback(acertou, questao) {
    const modal = document.getElementById('modal-feedback');
    const box = document.getElementById('feedback-box');
    const icon = document.getElementById('feedback-icon');
    const title = document.getElementById('feedback-title');
    const msg = document.getElementById('feedback-message');
    const commentBox = document.getElementById('feedback-comment');
    const correctDiv = document.getElementById('feedback-correct-answer');
    
    modal.classList.remove('hidden');
    box.className = `modal-content feedback-box ${acertou ? 'correct' : 'incorrect'}`;
    
    if (acertou) {
        icon.innerText = "🎉";
        title.innerText = "Resposta Correta!";
        msg.innerText = msgsMotivacionaisAcerto[Math.floor(Math.random() * msgsMotivacionaisAcerto.length)];
        correctDiv.classList.add('hidden');
        dispararConfete();
    } else {
        icon.innerText = "❌";
        title.innerText = "Resposta Incorreta";
        msg.innerText = msgsMotivacionaisErro[Math.floor(Math.random() * msgsMotivacionaisErro.length)];
        correctDiv.classList.remove('hidden');
        document.getElementById('texto-correta').innerText = questao.correta;
    }

    commentBox.innerText = questao.comentario || "Nenhum comentário disponível para esta questão.";
}

function dispararConfete() {
    if(typeof confetti !== 'undefined') {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    }
}

function proximaQuestaoOuResultado() {
    document.getElementById('modal-feedback').classList.add('hidden');
    alternativaSelecionada = null;

    appState.indiceQuestaoAtual++;
    
    if (appState.indiceQuestaoAtual < appState.provaAtual.length) {
        renderizarQuestao();
    } else {
        finalizarProva();
    }
}

// ===== RESULTADOS E GAMIFICAÇÃO =====
function finalizarProva() {
    clearInterval(window.timerInterval);
    document.getElementById('progress-fill').style.width = `100%`;
    
    const acertos = appState.respostas.filter(r => r).length;
    const total = appState.provaAtual.length;
    const percentual = Math.round((acertos / total) * 100);
    
    const tempoFinal = document.getElementById('tempo-decorrido').innerText;

    // Calcular Medalha
    let medalhaHTML = "";
    let classeCor = "success";
    let msgResultado = "";

    if (percentual === 100) {
        medalhaHTML = "🏆"; msgResultado = "Perfeito! Você é um Mestre."; appState.medalhas.mestre++;
    } else if (percentual >= 95) {
        medalhaHTML = "🥇"; msgResultado = "Incrível! Medalha de Ouro."; appState.medalhas.ouro++;
    } else if (percentual >= 85) {
        medalhaHTML = "🥈"; msgResultado = "Ótimo trabalho! Medalha de Prata."; appState.medalhas.prata++;
    } else if (percentual >= 70) {
        medalhaHTML = "🥉"; msgResultado = "Bom trabalho! Medalha de Bronze."; appState.medalhas.bronze++;
    } else {
        medalhaHTML = "📚"; msgResultado = "Continue estudando, você consegue melhorar!"; classeCor = "danger";
    }

    // Histórico
    const tentativaData = {
        data: new Date().toISOString(),
        nota: percentual,
        acertos,
        total,
        tempo: tempoFinal,
        materia: appState.usuario.materia
    };
    appState.historico.push(tentativaData);

    // Sistema de Troféus (100% 3 vezes)
    const perfeicoes = appState.historico.filter(t => t.nota === 100).length;
    let desbloqueouTrofeu = false;
    
    if (perfeicoes > 0 && perfeicoes % 3 === 0 && percentual === 100) {
        appState.trofeus++;
        desbloqueouTrofeu = true;
    }

    salvarDadosLocais();

    // Renderizar Tela de Resultado
    trocarTela('tela-prova', 'tela-resultado');
    
    document.getElementById('medalha-container').innerHTML = medalhaHTML;
    const percEl = document.getElementById('resultado-percentual');
    percEl.innerText = `${percentual}%`;
    percEl.className = `percentual-destaque ${classeCor}`;
    document.getElementById('resultado-mensagem').innerText = msgResultado;

    document.getElementById('res-acertos').innerText = acertos;
    document.getElementById('res-erros').innerText = total - acertos;
    document.getElementById('res-tempo').innerText = tempoFinal;

    const alertTrofeu = document.getElementById('novo-trofeu-alert');
    if(desbloqueouTrofeu) {
        alertTrofeu.classList.remove('hidden');
        if(typeof confetti !== 'undefined') {
            let duration = 3000;
            let end = Date.now() + duration;
            (function frame() {
                confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700'] });
                confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }
    } else {
        alertTrofeu.classList.add('hidden');
    }
}

// ===== PAINEL DE EVOLUÇÃO =====
let graficoEvolucao = null;

function mostrarPainelEvolucao() {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    document.getElementById('tela-painel').classList.add('ativa');

    document.getElementById('perfil-nome').innerText = appState.usuario.nome || "Aluno";
    document.getElementById('perfil-trofeus').innerText = appState.trofeus;
    document.getElementById('perfil-ouros').innerText = appState.medalhas.ouro;
    document.getElementById('perfil-pratas').innerText = appState.medalhas.prata;
    document.getElementById('perfil-bronzes').innerText = appState.medalhas.bronze;

    const hist = appState.historico;
    
    document.getElementById('dash-tentativas').innerText = hist.length;
    
    if (hist.length > 0) {
        const notas = hist.map(t => t.nota);
        document.getElementById('dash-melhor-nota').innerText = `${Math.max(...notas)}%`;
        
        const media = Math.round(notas.reduce((a,b)=>a+b,0) / notas.length);
        document.getElementById('dash-media').innerText = `${media}%`;

        // Sequência atual (quantas seguidas acima de 70%)
        let seq = 0;
        for(let i = hist.length - 1; i >= 0; i--) {
            if(hist[i].nota >= 70) seq++; else break;
        }
        document.getElementById('dash-sequencia').innerText = `${seq} 🔥`;

        renderizarGrafico(notas);
    }

    // Progresso Mestre
    const perfeicoes = hist.filter(t => t.nota === 100).length;
    const progressoAtual = perfeicoes % 3;
    let estrelasStr = "";
    for(let i=0; i<3; i++) estrelasStr += (i < progressoAtual) ? "⭐" : "☆";
    document.getElementById('estrelas-mestre').innerText = estrelasStr;
    document.getElementById('texto-progresso-mestre').innerText = `${progressoAtual} de 3 perfeições para o próximo Troféu`;

    // Adaptive Learning
    const listaAssuntos = document.getElementById('lista-assuntos-fracos');
    listaAssuntos.innerHTML = '';
    
    // Ordena assuntos por mais erros
    const sortedErros = Object.entries(appState.errosPorAssunto)
        .filter(([_, qt]) => qt > 0)
        .sort((a,b) => b[1] - a[1]);
        
    if(sortedErros.length > 0) {
        sortedErros.slice(0, 5).forEach(([assunto, qt]) => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${assunto}</strong> - Errou ${qt} vezes`;
            listaAssuntos.appendChild(li);
        });
    } else {
        listaAssuntos.innerHTML = '<li>Nenhum erro registrado ainda! Continue assim.</li>';
    }
}

function renderizarGrafico(notas) {
    const ctx = document.getElementById('chart-evolucao').getContext('2d');
    
    if (graficoEvolucao) {
        graficoEvolucao.destroy();
    }

    const labels = notas.map((_, i) => `T${i+1}`);

    // Pegar cor da variável CSS
    const rootStyles = getComputedStyle(document.documentElement);
    const accentColor = rootStyles.getPropertyValue('--accent-color').trim();

    graficoEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Aproveitamento (%)',
                data: notas,
                borderColor: accentColor,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: accentColor,
                pointRadius: 5,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#cbd5e1' }
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#cbd5e1' }
                }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
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
    
    atualizarUIInicial();
}
