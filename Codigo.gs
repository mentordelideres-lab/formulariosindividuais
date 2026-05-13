const CONFIG = {
  TURMAS: {
    'Turma 1': '1liKvrCmxEcJbFJbBb4UtfqcNAl_SIfmX',
    'Turma 2': '1pf4reXpDzSAPkEN9dRJ1BlsFgRx0xNKj',
    'Turma 3': '1_jdyvrocuzsrpSyDCzaMCzTkPt0_xsxf',
  },
  PASTA_REVISAR_ID: '17GwD6glRU4d666Jk2K7NRPqPGNBzOJei',
  CAMPO_NOME_ALUNO: 'Nome do aluno',
  CAMPO_TURMA: 'Turma',
  EMAIL_ALERTA: 'seu-email@dominio.com',
};

function onFormSubmit(e) {
  const respostas = mapearRespostas(e);
  const nomeAluno = respostas[CONFIG.CAMPO_NOME_ALUNO];

  if (!nomeAluno) {
    notificarErro('Resposta sem o campo configurado em CAMPO_NOME_ALUNO.', respostas);
    return;
  }

  const turmaDeclarada = respostas[CONFIG.CAMPO_TURMA];
  const encontradas = encontrarPastasAluno(nomeAluno, turmaDeclarada);

  let pastaDestino;
  let alerta = null;

  if (encontradas.length === 1) {
    pastaDestino = encontradas[0].pasta;
  } else if (encontradas.length === 0) {
    pastaDestino = DriveApp.getFolderById(CONFIG.PASTA_REVISAR_ID);
    alerta = `Pasta nao encontrada para "${nomeAluno}"${turmaDeclarada ? ' em ' + turmaDeclarada : ''}. PDF salvo em _revisar.`;
  } else {
    pastaDestino = DriveApp.getFolderById(CONFIG.PASTA_REVISAR_ID);
    const lista = encontradas.map((m) => m.turma).join(', ');
    alerta = `Aluno "${nomeAluno}" encontrado em multiplas turmas (${lista}). PDF salvo em _revisar.`;
  }

  const pdf = gerarPdfDaResposta(e, nomeAluno);
  pastaDestino.createFile(pdf);

  if (alerta) notificarErro(alerta, respostas);
}

function mapearRespostas(e) {
  const map = {};
  e.response.getItemResponses().forEach((ir) => {
    map[ir.getItem().getTitle().trim()] = ir.getResponse();
  });
  return map;
}

function encontrarPastasAluno(nome, turmaDeclarada) {
  const alvo = normalizar(nome);
  const turmasParaBuscar = turmaDeclarada && CONFIG.TURMAS[turmaDeclarada]
    ? { [turmaDeclarada]: CONFIG.TURMAS[turmaDeclarada] }
    : CONFIG.TURMAS;

  const achadas = [];
  Object.entries(turmasParaBuscar).forEach(([turma, pastaId]) => {
    const pastas = DriveApp.getFolderById(pastaId).getFolders();
    while (pastas.hasNext()) {
      const p = pastas.next();
      if (normalizar(p.getName()) === alvo) achadas.push({ turma, pasta: p });
    }
  });
  return achadas;
}

function normalizar(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function gerarPdfDaResposta(e, nomeAluno) {
  const form = FormApp.getActiveForm();
  const html = montarHtmlResposta(e, nomeAluno, form);
  const blob = Utilities.newBlob(html, 'text/html').getAs('application/pdf');
  const data = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  blob.setName(`${data} - ${form.getTitle()} - ${nomeAluno}.pdf`);
  return blob;
}

function montarHtmlResposta(e, nomeAluno, form) {
  const dataFmt = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
  const linhas = e.response.getItemResponses().map((ir) => {
    const r = ir.getResponse();
    const v = Array.isArray(r) ? r.join(', ') : r;
    return `<p><b>${escapar(ir.getItem().getTitle())}</b><br>${escapar(v)}</p>`;
  });
  return [
    `<h1>${escapar(form.getTitle())}</h1>`,
    `<p><b>Aluno:</b> ${escapar(nomeAluno)}</p>`,
    `<p><b>Data:</b> ${dataFmt}</p>`,
    '<hr>',
    ...linhas,
  ].join('');
}

function escapar(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function notificarErro(motivo, respostas) {
  MailApp.sendEmail(
    CONFIG.EMAIL_ALERTA,
    '[Formularios] Atencao necessaria',
    `${motivo}\n\nRespostas:\n${JSON.stringify(respostas, null, 2)}`
  );
}

function instalarTrigger() {
  const form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onFormSubmit')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();
}
