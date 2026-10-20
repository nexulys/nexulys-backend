const { escapeRegex, escapeHtml, escapeCsvCell } = require('../../utils/escape');

describe('escapeRegex — anti injection de regex / ReDoS', () => {
  it('neutralise les métacaractères', () => {
    expect(escapeRegex('.*')).toBe('\\.\\*');
    expect(escapeRegex('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
  });

  it('un nom de client « .* » ne matche plus tout', () => {
    const re = new RegExp(`^${escapeRegex('.*')}$`, 'i');
    expect(re.test('Acme Corp')).toBe(false);
    expect(re.test('.*')).toBe(true);
  });

  it('ancré, un nom ne matche plus un homonyme plus long', () => {
    const re = new RegExp(`^${escapeRegex('Acme')}$`, 'i');
    expect(re.test('Acme')).toBe(true);
    expect(re.test('Acme Industries')).toBe(false);
  });

  it('un motif ReDoS est inoffensif une fois échappé', () => {
    const re = new RegExp(escapeRegex('(a+)+$'), 'i');
    const debut = Date.now();
    re.test('a'.repeat(40) + 'b');
    expect(Date.now() - debut).toBeLessThan(100);
  });

  it('gère null et undefined', () => {
    expect(escapeRegex(null)).toBe('');
    expect(escapeRegex(undefined)).toBe('');
  });
});

describe('escapeHtml — anti XSS', () => {
  it('neutralise une balise script', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralise une sortie d\'attribut', () => {
    expect(escapeHtml('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)');
  });
});

describe('escapeCsvCell — anti injection de formule', () => {
  it('préfixe les cellules commençant par un caractère de formule', () => {
    expect(escapeCsvCell('=cmd|\'/c calc\'!A1')).toBe('"\'=cmd|\'/c calc\'!A1"');
    expect(escapeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(escapeCsvCell('-2')).toBe('"\'-2"');
    expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
  });

  it('laisse une valeur normale intacte et double les guillemets', () => {
    expect(escapeCsvCell('Dupont')).toBe('"Dupont"');
    expect(escapeCsvCell('Say "hi"')).toBe('"Say ""hi"""');
  });
});
