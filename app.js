const DISCOGS_TOKEN = "BECGofjKQBJqAgRHPhnZlQOQUbVEGnDtiALEpmPB";

const firebaseConfig = {
    apiKey: "AIzaSyAVqrOH83O8C297l4C9C-hmxKXmzxdvD28",
    authDomain: "vinildiscogs.firebaseapp.com",
    projectId: "vinildiscogs",
    storageBucket: "vinildiscogs.firebasestorage.app",
    messagingSenderId: "937806904189",
    appId: "1:937806904189:web:8b9df493b56ad306d8aa14",
    measurementId: "G-MKBYBS7CBS"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const colecaoEstoque = collection(db, "estoque");
const colecaoVendas = collection(db, "vendas");
const docTotais = doc(db, "relatorios", "totais");

let estoqueVinis = [];

// ==========================================
// BUSCA NO DISCOGS (COM CAPA)
// ==========================================
document.getElementById('btn-buscar-discogs').addEventListener('click', async () => {
    const termoBusca = document.getElementById('input-discogs').value.trim();
    const btn = document.getElementById('btn-buscar-discogs');

    if (!termoBusca) {
        alert("Digite o nome de um álbum ou artista para buscar.");
        return;
    }

    btn.textContent = "Buscando...";
    btn.disabled = true;

    try {
        const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(termoBusca)}&type=release&format=vinyl&per_page=5&token=${DISCOGS_TOKEN}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();

        if (dados.results && dados.results.length > 0) {
            mostrarResultadosDiscogs(dados.results.slice(0, 5));
        } else {
            alert("Nenhum disco encontrado com esse nome no Discogs.");
        }
    } catch (erro) {
        console.error("Erro no Discogs:", erro);
        alert("Erro ao buscar no Discogs. Verifique seu token e conexão.");
    } finally {
        btn.textContent = "Buscar Dados";
        btn.disabled = false;
    }
});

function mostrarResultadosDiscogs(resultados) {
    const listaAnterior = document.getElementById('lista-discogs');
    if (listaAnterior) listaAnterior.remove();

    const lista = document.createElement('div');
    lista.id = 'lista-discogs';
    lista.className = 'lista-discogs';

    resultados.forEach((resultado) => {
        const partesTitulo = resultado.title.split(' - ');
        const artista = partesTitulo[0] || '';
        const titulo = partesTitulo[1] || resultado.title;
        const ano = resultado.year ? ` (${resultado.year})` : '';
        const urlDaCapa = resultado.cover_image || ''; 

        const item = document.createElement('div');
        item.className = 'discogs-item';
        
        item.innerHTML = `
            <img src="${urlDaCapa}" style="width: 30px; height: 30px; object-fit: cover; margin-right: 10px; border-radius: 3px;">
            <span>${resultado.title}${ano}</span>
        `;
        item.style.display = "flex";
        item.style.alignItems = "center";

        item.addEventListener('click', () => {
            document.getElementById('titulo').value = titulo.trim();
            document.getElementById('artista').value = artista.trim();
            
            // Grava a URL da capa no campo oculto e mostra o preview
            const inputCapa = document.getElementById('url-capa');
            const preview = document.getElementById('preview-capa');
            
            if (inputCapa && preview) {
                inputCapa.value = urlDaCapa;
                if (urlDaCapa) {
                    preview.src = urlDaCapa;
                    preview.style.display = 'block';
                }
            }

            lista.remove();
            mostrarMensagem("🎵 Selecionado: " + resultado.title);
        });

        lista.appendChild(item);
    });

    const buscaDiscogs = document.querySelector('.busca-discogs');
    buscaDiscogs.insertAdjacentElement('afterend', lista);
}

document.addEventListener('click', (e) => {
    const lista = document.getElementById('lista-discogs');
    if (lista && !lista.contains(e.target) && e.target.id !== 'btn-buscar-discogs') {
        lista.remove();
    }
});

// ==========================================
// CARREGAMENTO E DASHBOARD FINANCEIRO
// ==========================================
async function carregarDados() {
    try {
        const snapshotEstoque = await getDocs(colecaoEstoque);
        estoqueVinis = snapshotEstoque.docs.map(d => ({ id: d.id, ...d.data() }));

        await carregarTotais();
        renderizarEstoque();
    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        document.getElementById('tabela-estoque').innerHTML =
            '<tr><td colspan="6" class="esgotado">Erro ao conectar com o banco de dados.</td></tr>';
    }
}

async function carregarTotais() {
    try {
        const snap = await getDoc(docTotais);
        if (snap.exists()) {
            const { faturamento = 0, custo = 0, qtdVendas = 0 } = snap.data();
            const lucro = faturamento - custo; 
            atualizarDashboard(faturamento, custo, lucro, qtdVendas); 
        } else {
            await recalcularTotais();
        }
    } catch (erro) {
        console.error("Erro ao carregar totais:", erro);
    }
}

async function recalcularTotais() {
    const snapshotVendas = await getDocs(colecaoVendas);
    let faturamento = 0, custo = 0;
    
    snapshotVendas.forEach(d => {
        faturamento += Number(d.data().venda || 0);
        custo += Number(d.data().custo || 0);
    });
    
    const qtdVendas = snapshotVendas.size;
    const lucro = faturamento - custo; 
    
    await setDoc(docTotais, { faturamento, custo, qtdVendas });
    atualizarDashboard(faturamento, custo, lucro, qtdVendas);
}

function atualizarDashboard(faturamento, custo, lucro, qtdVendas) {
    document.getElementById('valor-faturamento').textContent =
        Number(faturamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    document.getElementById('valor-custo').textContent =
        Number(custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
    document.getElementById('valor-lucro').textContent =
        Number(lucro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
    document.getElementById('qtd-vendas').textContent = qtdVendas;
}

// ==========================================
// RENDERIZAÇÃO DA TABELA DE ESTOQUE
// ==========================================
function renderizarEstoque() {
    const tabela = document.getElementById('tabela-estoque');
    tabela.innerHTML = '';

    if (estoqueVinis.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum disco no estoque.</td></tr>';
        return;
    }

    estoqueVinis.forEach((disco) => {
        const linha = document.createElement('tr');
        const precoFormatado = Number(disco.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const statusEstoque = disco.quantidade > 0
            ? disco.quantidade
            : '<span class="esgotado">Esgotado</span>';

        const imgCapa = disco.capa 
            ? `<img src="${disco.capa}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` 
            : `<div style="width: 50px; height: 50px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px;">Sem Capa</div>`;

        linha.innerHTML = `
            <td data-label="Capa">${imgCapa}</td>
            <td data-label="Título">${disco.titulo}</td>
            <td data-label="Artista">${disco.artista}</td>
            <td data-label="Estoque">${statusEstoque}</td>
            <td data-label="Preço">${precoFormatado}</td>
            <td data-label="Ações">
                <button class="btn-vender ${disco.quantidade === 0 ? 'btn-disabled' : ''}"
                        data-id="${disco.id}"
                        ${disco.quantidade === 0 ? 'disabled' : ''}>Vender</button>
                <button class="btn-remover" data-id="${disco.id}">Excluir</button>
            </td>
        `;
        tabela.appendChild(linha);
    });

    document.querySelectorAll('.btn-vender').forEach(btn => {
        btn.addEventListener('click', (e) => venderDisco(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-remover').forEach(btn => {
        btn.addEventListener('click', (e) => removerDisco(e.target.dataset.id));
    });
}

// ==========================================
// CADASTRO NO ESTOQUE (SALVAR NO FIREBASE)
// ==========================================
document.getElementById('form-disco').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.textContent = "Salvando...";
    btnSalvar.disabled = true;

    const titulo = document.getElementById('titulo').value.trim();
    const artista = document.getElementById('artista').value.trim();

    const duplicata = estoqueVinis.find(
        d => d.titulo.toLowerCase() === titulo.toLowerCase() &&
             d.artista.toLowerCase() === artista.toLowerCase()
    );

    if (duplicata) {
        if (!confirm(`"${titulo}" de ${artista} já está no estoque. Deseja adicionar mesmo assim?`)) {
            btnSalvar.textContent = "Salvar no Estoque";
            btnSalvar.disabled = false;
            return;
        }
    }

    const inputCapa = document.getElementById('url-capa');

    const novoDisco = {
        titulo,
        artista,
        capa: inputCapa ? inputCapa.value : '', // Salva o link da imagem
        quantidade: parseInt(document.getElementById('quantidade').value),
        precoCusto: parseFloat(document.getElementById('preco-custo').value),
        precoVenda: parseFloat(document.getElementById('preco-venda').value)
    };

    try {
        const docRef = await addDoc(colecaoEstoque, novoDisco);
        estoqueVinis.push({ id: docRef.id, ...novoDisco });
        renderizarEstoque();
        
        document.getElementById('form-disco').reset();
        document.getElementById('input-discogs').value = '';
        if (inputCapa) inputCapa.value = '';
        
        const preview = document.getElementById('preview-capa');
        if (preview) preview.style.display = 'none';

        mostrarMensagem("Disco adicionado ao estoque!");
    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        alert("Erro ao salvar o disco no banco de dados.");
    } finally {
        btnSalvar.textContent = "Salvar no Estoque";
        btnSalvar.disabled = false;
    }
});

// ==========================================
// REGISTRAR VENDA
// ==========================================
async function venderDisco(idDisco) {
    const discoIndex = estoqueVinis.findIndex(d => d.id === idDisco);
    const disco = estoqueVinis[discoIndex];

    if (!disco || disco.quantidade <= 0) return;

    try {
        const discoRef = doc(db, "estoque", idDisco);
        await updateDoc(discoRef, { quantidade: disco.quantidade - 1 });

        const novaVenda = {
            titulo: disco.titulo,
            custo: Number(disco.precoCusto || 0),
            venda: Number(disco.precoVenda || 0),
            data: new Date().toISOString()
        };
        await addDoc(colecaoVendas, novaVenda);

        const snapTotais = await getDoc(docTotais);
        const totaisAtuais = snapTotais.exists() ? snapTotais.data() : { faturamento: 0, custo: 0, qtdVendas: 0 };
        
        const novosTotais = {
            faturamento: Number(totaisAtuais.faturamento || 0) + Number(disco.precoVenda || 0),
            custo: Number(totaisAtuais.custo || 0) + Number(disco.precoCusto || 0),
            qtdVendas: Number(totaisAtuais.qtdVendas || 0) + 1
        };
        
        await setDoc(docTotais, novosTotais);

        estoqueVinis[discoIndex].quantidade -= 1;
        
        const novoLucro = novosTotais.faturamento - novosTotais.custo;
        atualizarDashboard(novosTotais.faturamento, novosTotais.custo, novoLucro, novosTotais.qtdVendas);
        
        renderizarEstoque();
        mostrarMensagem("Venda registrada!");
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        alert("Erro ao processar a venda no banco de dados.");
    }
}

// ==========================================
// EXCLUIR DISCO
// ==========================================
async function removerDisco(idDisco) {
    if (confirm('Tem certeza que deseja remover este disco permanentemente?')) {
        try {
            await deleteDoc(doc(db, "estoque", idDisco));
            estoqueVinis = estoqueVinis.filter(d => d.id !== idDisco);
            renderizarEstoque();
            mostrarMensagem("Disco removido.");
        } catch (erro) {
            console.error("Erro ao excluir:", erro);
            alert("Erro ao excluir o disco do banco de dados.");
        }
    }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function mostrarMensagem(texto) {
    const toast = document.getElementById('toast');
    toast.textContent = texto;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Inicia a aplicação
carregarDados();
