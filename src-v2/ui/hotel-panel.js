/* v2.3 behavior-equivalent extraction: hotel analysis table. Generated once, then maintained as canonical source. */
function renderHotels(){document.getElementById('hotelRows').innerHTML=HOTELS.map(r=>`<tr>${r.map(x=>`<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}
