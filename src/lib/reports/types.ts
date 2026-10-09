export interface Bron {
	label: string;
	url: string;
}

export interface Tip {
	prioriteit: 'hoog' | 'gemiddeld' | 'laag';
	titel: string;
	tekst: string;
	voordeel?: string;
	links: Bron[];
}
