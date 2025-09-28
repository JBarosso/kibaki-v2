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
				},
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				fadeOut: {
					'0%': { opacity: '1' },
					'100%': { opacity: '0' }
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				slideDown: {
					'0%': { transform: 'translateY(-10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				indeterminate: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(400%)' }
				},
				skeletonPulse: {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				}
			},
			animation: {
				shake: 'shake 0.3s ease-in-out',
				fadeIn: 'fadeIn 300ms ease-out',
				fadeOut: 'fadeOut 300ms ease-out',
				slideUp: 'slideUp 300ms ease-out',
				slideDown: 'slideDown 300ms ease-out',
				indeterminate: 'indeterminate 1.5s linear infinite',
				skeletonPulse: 'skeletonPulse 2s ease-in-out infinite'
			},
			transitionDuration: {
				'50': '50ms',
				'150': '150ms',
				'400': '400ms',
				'600': '600ms'
			}
		},
	},
	plugins: [],
};
