/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte}',
	],
	theme: {
		extend: {
			keyframes: {
				shake: {
					'0%, 100%': { transform: 'translateX(0)' },
					'25%': { transform: 'translateX(-5px)' },
					'75%': { transform: 'translateX(5px)' }
				}
			},
			animation: {
				shake: 'shake 0.3s ease-in-out'
			}
		},
	},
	plugins: [],
};
